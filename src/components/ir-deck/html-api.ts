export type Json = Record<string, unknown>;
export type BrandSettings = {
  brandColors: string[];
  theme: "light" | "dark";
  fontFamily: "Paperlogy" | "Pretendard";
};
export type HtmlReference = {
  userId: string;
  deckId: string;
  sourceId: string;
  requestId: string;
  brandSaveId: string;
  settings: BrandSettings;
  businessRevision: number;
  brandRevision?: number;
  jobId?: string;
  documentId?: string;
};
export type Placement = { x: number; y: number; width: number; height: number; zIndex: number };
export type ImageSlot = {
  id: string;
  slideId: string;
  origin: "generated" | "user";
  description: string;
  fit: "cover" | "contain";
  assetId: string | null;
  placement: Placement | null;
};
export type HtmlSlide = {
  groupEdits?: Record<string,{x:number;y:number}>; textEdits?: Record<string, import("@/lib/ir-slide-text").SlideTextEdit>;
  slideId: string;
  sectionLabel: string;
  headline: string;
  html: string;
  css: string;
};
export type HtmlView = {
  document_id: string;
  deck_id: string;
  image_revision: number;
  document: {
    schemaVersion: "ir_html_v1";
    canvas: { width: number; height: number };
    designTokens: { colors: Record<string, string | null> };
    slides: HtmlSlide[];
  };
  imageSlots: ImageSlot[];
  validation: { security_checked: boolean; original_html_render_checked: boolean };
  input_status?: {
    source_is_current: boolean;
    brand_is_current: boolean;
    business_is_current: boolean;
  };
};
export type ApiCall = (
  name: "ir-deck-html-api-v1" | "ir-deck-studio-v2" | "ir-deck-media-v2",
  body: Json,
) => Promise<Json>;
export const object = (v: unknown): v is Json =>
  v !== null && typeof v === "object" && !Array.isArray(v);
export function text(v: unknown): string {
  if (typeof v !== "string" || !v) throw new Error("서버 응답의 문서 정보를 확인하지 못했습니다.");
  return v;
}
export function number(v: unknown): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0)
    throw new Error("서버 저장 버전을 확인하지 못했습니다.");
  return v;
}
export function parseView(v: unknown, deckId: string): HtmlView {
  if (!object(v) || v["deck_id"] !== deckId || !object(v["document"]) || !object(v["validation"]))
    throw new Error("본인 덱의 완료 문서를 확인하지 못했습니다.");
  const d = v["document"],
    checked = v["validation"];
  if (
    checked["security_checked"] !== true ||
    checked["original_html_render_checked"] !== true ||
    d["schemaVersion"] !== "ir_html_v1" ||
    !object(d["canvas"]) ||
    d["canvas"]["width"] !== 1920 ||
    d["canvas"]["height"] !== 1080 ||
    !object(d["designTokens"]) ||
    !object(d["designTokens"]["colors"]) ||
    !Array.isArray(d["slides"]) ||
    d["slides"].length !== 7 ||
    !Array.isArray(v["imageSlots"])
  )
    throw new Error("슬라이드 검사 완료를 확인하지 못했습니다. 다시 조회해 주세요.");
  const ids = new Set<string>();
  for (const s of d["slides"]) {
    if (
      !object(s) ||
      !["slideId", "sectionLabel", "headline", "html", "css"].every(
        (k) => typeof s[k] === "string",
      ) ||
      !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(String(s["slideId"])) ||
      ids.has(String(s["slideId"]))
    )
      throw new Error("슬라이드 구성을 확인하지 못했습니다.");
    ids.add(String(s["slideId"]));
  }
  for (const [key, value] of Object.entries(d["designTokens"]["colors"]))
    if (
      !/^[A-Z_]+$/.test(key) ||
      (value !== null && (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)))
    )
      throw new Error("디자인 색상 정보를 확인하지 못했습니다.");
  for (const slot of v["imageSlots"]) {
    if (
      !object(slot) ||
      !ids.has(String(slot["slideId"])) ||
      typeof slot["id"] !== "string" ||
      !["generated", "user"].includes(String(slot["origin"])) ||
      !["cover", "contain"].includes(String(slot["fit"]))
    )
      throw new Error("이미지 영역 정보를 확인하지 못했습니다.");
    if (slot["origin"] === "user") validatePlacement(slot["placement"]);
  }
  number(v["image_revision"]);
  text(v["document_id"]);
  return v as unknown as HtmlView;
}
export function validatePlacement(p: unknown): asserts p is Placement {
  if (
    !object(p) ||
    !["x", "y", "width", "height", "zIndex"].every(
      (k) => typeof p[k] === "number" && Number.isFinite(p[k]),
    ) ||
    Number(p["x"]) < 0 ||
    Number(p["y"]) < 0 ||
    Number(p["width"]) < 1 ||
    Number(p["height"]) < 1 ||
    Number(p["x"]) + Number(p["width"]) > 1920 ||
    Number(p["y"]) + Number(p["height"]) > 1080 ||
    !Number.isInteger(p["zIndex"]) ||
    Number(p["zIndex"]) < 0 ||
    Number(p["zIndex"]) > 10000
  )
    throw new Error("이미지가 슬라이드 영역을 벗어나지 않도록 위치와 크기를 확인해 주세요.");
}
export function signedUrl(raw: unknown, base: string, bucket: string): string {
  const url = new URL(text(raw));
  if (
    url.protocol !== "https:" ||
    url.origin !== new URL(base).origin ||
    url.username ||
    url.password ||
    !url.pathname.startsWith(`/storage/v1/object/sign/${bucket}/`) ||
    !url.searchParams.get("token")
  )
    throw new Error("안전한 파일 주소를 확인하지 못했습니다.");
  return url.href;
}
export async function startHtml(
  call: ApiCall,
  ref: HtmlReference,
  persist: (ref: HtmlReference) => void,
): Promise<Json> {
  let current = ref;
  if (current.brandRevision === undefined) {
    const existing = await call("ir-deck-studio-v2", {
      action: "get_brand_settings",
      deck_id: current.deckId,
    });
    const same =
      object(existing["settings"]) &&
      JSON.stringify(existing["settings"]["brandColors"]) ===
        JSON.stringify(current.settings.brandColors) &&
      existing["settings"]["theme"] === current.settings.theme &&
      existing["settings"]["fontFamily"] === current.settings.fontFamily;
    const saved = same
      ? existing
      : await call("ir-deck-studio-v2", {
          action: "save_brand_settings",
          deck_id: current.deckId,
          client_save_id: current.brandSaveId,
          expected_revision: number(existing["revision"]),
          settings: current.settings,
        });
    current = { ...current, brandRevision: number(saved["revision"]) };
    persist(current);
  }
  return call("ir-deck-html-api-v1", {
    action: "request_generation",
    deck_id: current.deckId,
    source_id: current.sourceId,
    client_request_id: current.requestId,
    expected_brand_revision: current.brandRevision,
    expected_business_revision: current.businessRevision,
  });
}
