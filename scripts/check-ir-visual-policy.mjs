import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import ts from "typescript";

const dir = path.resolve("node_modules/.cache/ir-visual-policy");
const modules = [
  "ir-html-contrast.server",
  "ir-html-render.server",
  "ir-html-images.server",
  "ir-html-export.server",
];
await fs.mkdir(dir, { recursive: true });
for (const name of modules) {
  let code = ts.transpileModule(await fs.readFile(`src/lib/${name}.ts`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const dependency of modules)
    code = code.replaceAll(`"./${dependency}"`, `"./${dependency}.mjs"`);
  await fs.writeFile(path.join(dir, name + ".mjs"), code);
}
const load = (name) => import(pathToFileURL(path.join(dir, name + ".mjs")).href);
const { acceptResidualContrast, acceptResidualVisualIssues, VISUAL_ISSUE_CODES } =
  await load("ir-html-contrast.server");
const { renderExportFile } = await load("ir-html-export.server");
const makeReport = (code) => ({
  passed: !code,
  fonts_loaded: true,
  slide_count: 7,
  contrast_scope: "solid_background_html_text_only",
  semantic_accuracy_verified: false,
  slides: Array.from({ length: 7 }, (_, i) => ({
    slideId: `slide-${i + 1}`,
    passed: !(i === 0 && code),
    issues: i === 0 && code ? [{ code, tag: "DIV" }] : [],
    contrast_checked: 1,
    contrast_unchecked: 0,
    text_nodes: 1,
  })),
});
for (const code of VISUAL_ISSUE_CODES) {
  const raw = makeReport(code);
  const accepted = acceptResidualVisualIssues(raw);
  assert.equal(accepted.passed, true);
  assert.equal(accepted.visual_passed, false);
  assert.equal(accepted.quality_remaining, 1);
  assert.equal(accepted.slides[0].quality_issues[0].code, code);
  assert.equal(accepted.warnings, undefined);
  assert.equal(raw.slides[0].issues.length, 1, "must not mutate source report");
}
assert.equal(
  acceptResidualContrast(makeReport("CONTENT_OVERFLOW")).passed,
  false,
  "first check still requires repair",
);
assert.equal(acceptResidualVisualIssues(makeReport("UNEXPECTED_ERROR")).passed, false);
assert.equal(
  acceptResidualVisualIssues({ ...makeReport("CLIPPED_TEXT"), fonts_loaded: false }).passed,
  false,
);
assert.equal(
  acceptResidualVisualIssues({ ...makeReport("CLIPPED_TEXT"), slide_count: 6 }).passed,
  false,
);
const mockReport = makeReport("TEXT_OUTSIDE_SLIDE");
let pdfCalls = 0;
const page = {
  setViewport: async () => {},
  setJavaScriptEnabled: async () => {},
  setRequestInterception: async () => {},
  on: () => {},
  setDefaultTimeout: () => {},
  emulateMediaType: async () => {},
  setContent: async () => {},
  evaluate: async (fn) => (fn.name === "measureInPage" ? mockReport : undefined),
  addStyleTag: async () => {},
  pdf: async () => {
    pdfCalls++;
    return Buffer.from("%PDF-test");
  },
  close: async () => {},
};
const document = {
  schemaVersion: "ir_html_v1",
  canvas: { width: 1920, height: 1080 },
  designTokens: { colors: { CANVAS: "#FFFFFF", INK: "#555559" } },
  slides: Array.from({ length: 7 }, (_, i) => ({
    slideId: `slide-${i + 1}`,
    html: `<section class="ir-slide" data-slide-id="slide-${i + 1}"><h1>슬라이드 ${i + 1}</h1><div class="overflow-test">화면 바깥에 남은 글자</div></section>`,
    css: `.ir-slide[data-slide-id="slide-${i + 1}"]{padding:96px;font-family:Pretendard;color:var(--ir-ink);font-size:32px}.ir-slide[data-slide-id="slide-${i + 1}"] .overflow-test{position:absolute;left:1850px;top:900px;width:500px}`,
  })),
};
const images = { slides: document.slides.map((s) => s.slideId), slots: [], data: {} };
const result = await renderExportFile({ newPage: async () => page }, document, images, "pdf", "");
assert.equal(pdfCalls, 1);
assert.equal(result.report.quality_remaining, 1);
mockReport.fonts_loaded = false;
await assert.rejects(
  renderExportFile({ newPage: async () => page }, document, images, "pdf", ""),
  /EXPORT_VALIDATION_FAILED/,
);
assert.equal(pdfCalls, 1);
console.log(
  "PASS visual policy: first check still blocks; known residual visual issues export; unknown errors/fonts/missing slides block; private audit retained without warnings or AI calls.",
);

if (process.env.IR_HTML_LOCAL_CHROME) {
  const { defaultBrowser, defaultFonts, inspectWithBrowser } = await load("ir-html-render.server");
  const browser = await defaultBrowser(process.env);
  try {
    const fonts = await defaultFonts();
    const raw = await inspectWithBrowser(browser, document, fonts);
    assert.equal(raw.passed, false);
    assert.ok(raw.slides.some((s) => s.issues.some((i) => i.code === "TEXT_OUTSIDE_SLIDE")));
    for (const format of ["pdf", "pptx"]) {
      const actual = await renderExportFile(browser, document, images, format, fonts);
      assert.equal(actual.report.passed, true);
      assert.ok(actual.report.quality_remaining > 0);
      assert.equal(actual.report.warnings, undefined);
      if (format === "pdf")
        assert.equal((actual.bytes.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length, 7);
      else {
        const require = createRequire(import.meta.url);
        const zip = await require("jszip").loadAsync(actual.bytes);
        assert.equal(
          Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p)).length,
          7,
        );
      }
      await fs.writeFile(path.join(dir, `residual-overflow.${format}`), actual.bytes);
      console.log(
        `PASS actual Chromium ${format}: residual overflow accepted, 7 pages/slides, no UI warning.`,
      );
    }
  } finally {
    await browser.close();
  }
}
