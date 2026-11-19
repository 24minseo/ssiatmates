import type { AnalysisReference } from "./analysis";

export const slideNames = [
  "Business",
  "Problem",
  "Target Customer",
  "Solution",
  "Product & Service",
  "Market Analysis",
  "Revenue Model",
];
export const reviewFields = [
  ["제목", "Business", /^(?:제목|사업\/서비스명|사업명|서비스명|회사명|프로젝트명)\s*[:：-]/i],
  ["문제 인식", "Problem", /^(?:문제 인식|문제|고객 문제|pain point)\s*[:：-]/i],
  ["핵심 고객", "Target Customer", /^(?:고객|타깃 고객|핵심 고객|target)\s*[:：-]/i],
  ["해결책", "Solution", /^(?:해결책|해결 방안|솔루션|solution)\s*[:：-]/i],
  [
    "제품·서비스",
    "Product & Service",
    /^(?:제품|서비스|제품\/서비스|제품·서비스|product)\s*[:：-]/i,
  ],
  [
    "시장 분석",
    "Market Analysis",
    /^(?:시장 분석|시장|시장규모|시장 규모|시장변화|시장 변화|tam|sam)\s*[:：-]/i,
  ],
  ["수익 모델", "Revenue Model", /^(?:수익 모델|비즈니스 모델|bm|매출 모델)\s*[:：-]/i],
] as const;
export const themes = [
  ["Precision Tech", "정교함 · 신뢰감 · 데이터 중심", "bg-[#FAFAF9] text-ink"],
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
  analysis?: AnalysisReference | undefined;
  source: string;
  fileName: string;
  review: Record<string, string>;
  theme: string;
  primaryColor?: string;
  primaryColor2?: string;
  colorMode?: "light" | "dark";
  slides: Slide[];
  activeSlide: number;
  projectId: string | null;
};
export type Project = {
  id: string;
  title: string;
  updatedAt: number;
  createdAt?: number;
  lastViewedAt?: number;
  draft: Draft;
};
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
  theme: "Custom",
  primaryColor: "#1F8064",
  colorMode: "light",
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
    if (destination === "Business") {
      target.title = value;
      target.body = "사업의 핵심을 소개합니다.";
    } else target.body = value;
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
    (value["theme"] !== "Custom" && !themes.some(([name]) => name === value["theme"])) ||
    !record(value["review"]) ||
    !Object.values(value["review"]).every((v) => typeof v === "string") ||
    !Number.isInteger(value["activeSlide"]) ||
    !Array.isArray(value["slides"]) ||
    !value["slides"].length
  )
    return false;
  if (value["projectId"] !== null && typeof value["projectId"] !== "string") return false;
  if (value["primaryColor"] !== undefined && typeof value["primaryColor"] !== "string")
    return false;
  if (value["primaryColor2"] !== undefined && typeof value["primaryColor2"] !== "string")
    return false;
  if (value["secondaryColor"] !== undefined && typeof value["secondaryColor"] !== "string")
    return false;
  if (
    value["colorMode"] !== undefined &&
    value["colorMode"] !== "light" &&
    value["colorMode"] !== "dark"
  )
    return false;
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
function migrateDraftColors(draft: Draft): Draft {
  const legacyColor = (draft as Draft & { secondaryColor?: unknown }).secondaryColor;
  if (!draft.primaryColor2 && typeof legacyColor === "string") draft.primaryColor2 = legacyColor;
  return draft;
}
function migrateSlideOrder(draft: Draft): Draft {
  const legacyNames: Record<string, string> = {
    Business: "Cover",
    "Product & Service": "Product",
    "Market Analysis": "Market",
    "Revenue Model": "Business Model",
  };
  const existing = new Map(draft.slides.map((slide) => [slide.name, slide]));
  draft.slides = slideNames.map((name) => {
    const legacy = legacyNames[name];
    const slide = existing.get(name) || (legacy ? existing.get(legacy) : undefined);
    if (slide) return { ...slide, name };
    const fresh = newSlide(name, name);
    if (name === "Target Customer" && draft.review["핵심 고객"]?.trim()) {
      fresh.body = draft.review["핵심 고객"].trim();
    }
    return fresh;
  });
  draft.activeSlide = Math.max(0, Math.min(draft.activeSlide, draft.slides.length - 1));
  return draft;
}
// Keep the previous implementation's key intact and import its saved deck once.
export function restoreWorkspace(current: string | null, legacy: string | null): Workspace | null {
  if (current) {
    let data: unknown = null;
    try {
      data = JSON.parse(current);
    } catch {
      data = null;
    }
    if (
      record(data) &&
      validDraft(data["draft"]) &&
      Array.isArray(data["projects"]) &&
      data["projects"].every(
        (p) =>
          record(p) &&
          typeof p["id"] === "string" &&
          typeof p["title"] === "string" &&
          typeof p["updatedAt"] === "number" &&
          validDraft(p["draft"]),
      )
    ) {
      const workspace = data as Workspace;
      migrateDraftColors(workspace.draft);
      migrateSlideOrder(workspace.draft);
      workspace.projects.forEach((project) => migrateDraftColors(project.draft));
      workspace.projects.forEach((project) => migrateSlideOrder(project.draft));
      workspace.draft.activeSlide = Math.max(
        0,
        Math.min(workspace.draft.activeSlide, workspace.draft.slides.length - 1),
      );
      return workspace;
    }
  }
  if (!legacy) return null;
  let old: unknown = null;
  try {
    old = JSON.parse(legacy);
  } catch {
    return null;
  }
  if (!record(old) || typeof old["source"] !== "string") return null;
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
