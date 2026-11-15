export const slideNames = [
  "Cover",
  "Problem",
  "Why Now",
  "Solution",
  "Product",
  "Market",
  "Business Model",
];
export const reviewFields = [
  ["사업/서비스명", "Cover", /^(?:사업\/서비스명|사업명|서비스명|회사명|프로젝트명)\s*[:：-]/i],
  ["문제 인식", "Problem", /^(?:문제 인식|문제|고객 문제|pain point)\s*[:：-]/i],
  ["해결책", "Solution", /^(?:해결책|해결 방안|솔루션|solution)\s*[:：-]/i],
  ["핵심 고객", "Problem", /^(?:고객|타깃 고객|핵심 고객|target)\s*[:：-]/i],
  ["제품·서비스", "Product", /^(?:제품|서비스|제품\/서비스|제품·서비스|product)\s*[:：-]/i],
  ["수익 모델", "Business Model", /^(?:수익 모델|비즈니스 모델|bm|매출 모델)\s*[:：-]/i],
  [
    "시장 분석",
    "Market",
    /^(?:시장 분석|시장|시장규모|시장 규모|시장변화|시장 변화|tam|sam)\s*[:：-]/i,
  ],
] as const;
export const themes = [
  ["Precision Tech", "정교함 · 신뢰감 · 데이터 중심", "bg-[#F4F8F5] text-ink"],
  ["Bold Momentum", "대담함 · 성장성 · 강한 대비", "bg-[#153E34] text-white"],
  ["Human Impact", "따뜻함 · 사람 중심 · 스토리텔링", "bg-[#F7F2E8] text-ink"],
] as const;
export type TextFormat = {
  font: string;
  size: number;
  color?: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  align: "left" | "center" | "right" | "justify";
  lineHeight: number;
  letterSpacing: number;
  opacity: number;
};
export type SlideElement = { id: string } & (
  { type: "text"; text: string } | { type: "image" | "video"; src: string }
);
export type Slide = {
  id: string;
  name: string;
  title: string;
  body: string;
  formats: Record<string, TextFormat>;
  elements: SlideElement[];
};
export type Draft = {
  source: string;
  fileName: string;
  review: Record<string, string>;
  theme: string;
  slides: Slide[];
  activeSlide: number;
  projectId: string | null;
};
export type Project = { id: string; title: string; updatedAt: number; draft: Draft };
export type Workspace = { projects: Project[]; draft: Draft };
export const storageKey = "ssiat-ir-deck-workspace-v2";
export const newId = () => crypto.randomUUID();
export const defaultFormat = (field: string): TextFormat => ({
  font: "Asta Sans",
  size: field === "title" ? 38 : 20,
  bold: field === "title",
  italic: false,
  underline: false,
  strike: false,
  align: "left",
  lineHeight: 1.5,
  letterSpacing: 0,
  opacity: 100,
});
export const newSlide = (
  name = "New Slide",
  title = "새 슬라이드",
  body = "내용을 입력해 주세요.",
): Slide => ({ id: newId(), name, title, body, formats: {}, elements: [] });
export const newDraft = (): Draft => ({
  source: "",
  fileName: "",
  review: {},
  theme: "Precision Tech",
  slides: slideNames.map((name, i) =>
    newSlide(
      name,
      i === 0 ? "사업 소개" : name,
      "문서에서 확인된 내용이 없습니다. 필요하면 직접 작성하거나 이 슬라이드를 삭제하세요.",
    ),
  ),
  activeSlide: 0,
  projectId: null,
});
export function extractSections(source: string): Record<string, string> {
  const lines = source
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return Object.fromEntries(
    reviewFields.map(([name, , pattern]) => [
      name,
      lines
        .filter((line) => pattern.test(line))
        .map((line) => line.replace(pattern, "").trim())
        .filter(Boolean)
        .join(" / ")
        .slice(0, 600),
    ]),
  );
}
export function buildSlides(review: Record<string, string>, source: string): Slide[] {
  const slides = newDraft().slides;
  for (const [key, destination] of reviewFields) {
    const target = slides.find((slide) => slide.name === destination)!;
    const value = review[key]?.trim();
    if (!value) continue;
    if (destination === "Cover") {
      target.title = value;
      target.body = "사업의 핵심을 소개합니다.";
    } else if (key === "핵심 고객")
      target.body = (review["문제 인식"]?.trim() ? target.body + "\n" : "") + "핵심 고객: " + value;
    else target.body = value;
  }
  const trend = source
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => /^(?:시장변화|시장 변화|왜 지금|시의성|why now)\s*[:：-]/i.test(line));
  if (trend) {
    const body = trend
      .replace(/^(?:시장변화|시장 변화|왜 지금|시의성|why now)\s*[:：-]/i, "")
      .trim();
    if (body) slides.find((slide) => slide.name === "Why Now")!.body = body;
  }
  return slides;
}
export function mediaUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
export function videoEmbed(src: string): string | null {
  try {
    const url = new URL(src);
    if (!["youtu.be", "youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname))
      return null;
    const id =
      url.hostname === "youtu.be"
        ? url.pathname.slice(1)
        : url.searchParams.get("v") || url.pathname.split("/").pop() || "";
    return /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validDraft(value: unknown): value is Draft {
  if (
    !record(value) ||
    typeof value["source"] !== "string" ||
    typeof value["fileName"] !== "string" ||
    !themes.some(([name]) => name === value["theme"]) ||
    !record(value["review"]) ||
    !Object.values(value["review"]).every((v) => typeof v === "string") ||
    !Number.isInteger(value["activeSlide"]) ||
    !Array.isArray(value["slides"]) ||
    !value["slides"].length
  )
    return false;
  if (value["projectId"] !== null && typeof value["projectId"] !== "string") return false;
  return value["slides"].every(
    (slide) =>
      record(slide) &&
      typeof slide["id"] === "string" &&
      typeof slide["name"] === "string" &&
      typeof slide["title"] === "string" &&
      typeof slide["body"] === "string" &&
      record(slide["formats"]) &&
      Object.values(slide["formats"]).every(
        (f) => record(f) && typeof f["font"] === "string" && typeof f["size"] === "number",
      ) &&
      Array.isArray(slide["elements"]) &&
      slide["elements"].every(
        (e) =>
          record(e) &&
          typeof e["id"] === "string" &&
          (e["type"] === "text"
            ? typeof e["text"] === "string"
            : (e["type"] === "image" || e["type"] === "video") && typeof e["src"] === "string"),
      ),
  );
}
// Keep the previous implementation's key intact and import its saved deck once.
export function restoreWorkspace(current: string | null, legacy: string | null): Workspace | null {
  if (current) {
    const data: unknown = JSON.parse(current);
    if (
      !record(data) ||
      !validDraft(data["draft"]) ||
      !Array.isArray(data["projects"]) ||
      !data["projects"].every(
        (p) =>
          record(p) &&
          typeof p["id"] === "string" &&
          typeof p["title"] === "string" &&
          typeof p["updatedAt"] === "number" &&
          validDraft(p["draft"]),
      )
    )
      throw new Error("저장 형식을 읽을 수 없습니다.");
    const workspace = data as Workspace;
    workspace.draft.activeSlide = Math.max(
      0,
      Math.min(workspace.draft.activeSlide, workspace.draft.slides.length - 1),
    );
    return workspace;
  }
  if (!legacy) return null;
  const old: unknown = JSON.parse(legacy);
  if (!record(old) || typeof old["source"] !== "string")
    throw new Error("이전 저장 내용을 읽을 수 없습니다.");
  const draft = newDraft();
  draft.source = old["source"];
  draft.review = extractSections(old["source"]);
  const theme = old["theme"] || old["selectedTheme"];
  if (themes.some(([name]) => name === theme)) draft.theme = String(theme);
  draft.slides =
    Array.isArray(old["slides"]) &&
    old["slides"].length &&
    old["slides"].every((s) => typeof s === "string")
      ? old["slides"].map((title, i) => newSlide(slideNames[i] || "New Slide", title, draft.source))
      : buildSlides(draft.review, draft.source);
  draft.projectId = newId();
  return {
    draft,
    projects: [
      {
        id: draft.projectId,
        title: draft.slides[0]!.title,
        updatedAt: Date.parse(String(old["savedAt"])) || Date.now(),
        draft: structuredClone(draft),
      },
    ],
  };
}
