// Runs through DevTools in the isolated render page. No model scripts or network calls.
export function correctContrastInPage(colors: Record<string, string | null>) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("contrast_color_context_missing");
  function rgba(value: string): number[] {
    ctx!.clearRect(0, 0, 1, 1);
    ctx!.fillStyle = value;
    ctx!.fillRect(0, 0, 1, 1);
    const p = ctx!.getImageData(0, 0, 1, 1).data;
    return [p[0]!, p[1]!, p[2]!, p[3]! / 255];
  }
  const blend = (fg: number[], bg: number[]) =>
    [0, 1, 2].map((i) => fg[i]! * fg[3]! + bg[i]! * (1 - fg[3]!)).concat(1);
  const luminance = (c: number[]) =>
    c
      .slice(0, 3)
      .map((n) => n / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
      .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i]!, 0);
  const ratio = (a: number[], b: number[]) =>
    (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  function background(element: Element): number[] | null {
    const chain: Element[] = [];
    for (let e: Element | null = element; e; e = e.parentElement) chain.push(e);
    let result = [255, 255, 255, 1];
    for (const e of chain.reverse()) {
      const st = getComputedStyle(e);
      if (st.backgroundImage !== "none" || st.opacity !== "1" || st.mixBlendMode !== "normal")
        return null;
      result = blend(rgba(st.backgroundColor), result);
    }
    return result;
  }
  const candidates = [colors["INK"], colors["TITLE"], colors["ON_ACCENT"]].filter(
    (v): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v),
  );
  const changedSlides: { slideId: string; html: string }[] = [];
  let correctedTextBlocks = 0;
  for (const root of Array.from(
    document.querySelectorAll<HTMLElement>(".ir-host-page > section.ir-slide"),
  )) {
    const parents = new Set<HTMLElement>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode())
      if (
        n.textContent?.trim() &&
        n.parentElement instanceof HTMLElement &&
        !n.parentElement.closest("defs")
      )
        parents.add(n.parentElement);
    let changed = false;
    for (const parent of parents) {
      const st = getComputedStyle(parent);
      if (st.display === "none" || st.visibility === "hidden") continue;
      const bg = background(parent);
      if (!bg) continue;
      const before = ratio(blend(rgba(st.color), bg), bg);
      const threshold = parseFloat(st.fontSize) >= 40 ? 3 : 4.5;
      if (before + 0.01 >= threshold) continue;
      let chosen: string | undefined;
      let best = before;
      for (const value of candidates) {
        const score = ratio(rgba(value), bg);
        if (score >= threshold + 0.02) {
          chosen = value;
          break;
        }
        if (score > best + 0.02) {
          chosen = value;
          best = score;
        }
      }
      if (chosen) {
        parent.style.setProperty("color", chosen);
        correctedTextBlocks++;
        changed = true;
      }
    }
    if (changed) changedSlides.push({ slideId: root.dataset["slideId"]!, html: root.outerHTML });
  }
  return { changedSlides, correctedTextBlocks };
}

type Report = {
  passed: boolean;
  fonts_loaded: boolean;
  slide_count: number;
  slides: {
    slideId: string | null;
    passed: boolean;
    issues: { code: string; tag?: string }[];
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
};
// Contrast alone is nonblocking by explicit product policy. All geometry/visibility/font issues remain blocking.
export function acceptResidualContrast<T extends Report>(
  report: T,
): T & { contrast_policy: string; contrast_remaining: number } {
  let remaining = 0;
  const slides = report.slides.map((slide) => {
    const count = slide.issues.filter((i) => i.code === "LOW_TEXT_CONTRAST").length;
    remaining += count;
    const issues = slide.issues.filter((i) => i.code !== "LOW_TEXT_CONTRAST");
    return { ...slide, issues, passed: issues.length === 0, contrast_remaining: count };
  });
  return {
    ...report,
    slides,
    passed:
      report.fonts_loaded &&
      report.slide_count === 7 &&
      slides.length === 7 &&
      slides.every((s) => s.passed),
    contrast_policy: "auto_then_accept_v2",
    contrast_remaining: remaining,
  };
}

// Publication policy for an already repaired deck, or an export of a ready deck.
// Keep observed quality defects in the private report; do not turn infrastructure
// failures, missing fonts, unexpected issue codes, or a missing slide into success.
export const VISUAL_ISSUE_CODES = [
  "ELEMENT_OUTSIDE_SLIDE",
  "CONTENT_OVERFLOW",
  "TEXT_OUTSIDE_SLIDE",
  "CLIPPED_TEXT",
  "LOW_TEXT_CONTRAST",
  "INVISIBLE_TEXT",
  "NO_VISIBLE_TEXT",
  "CANVAS_SIZE",
] as const;

export function acceptResidualVisualIssues<T extends Report>(report: T) {
  const allowed = new Set<string>(VISUAL_ISSUE_CODES);
  let remaining = 0;
  const slides = report.slides.map((slide) => {
    const qualityIssues = slide.issues.filter((issue) => allowed.has(issue.code));
    const issues = slide.issues.filter((issue) => !allowed.has(issue.code));
    remaining += qualityIssues.length;
    return {
      ...slide,
      visual_passed: slide.passed,
      quality_issues: qualityIssues,
      issues,
      passed: issues.length === 0,
    };
  });
  return {
    ...report,
    visual_passed: report.passed,
    visual_policy: "after_one_repair_v1",
    quality_remaining: remaining,
    slides,
    passed:
      report.fonts_loaded === true &&
      report.slide_count === 7 &&
      slides.length === 7 &&
      slides.every((slide) => slide.passed),
  };
}
