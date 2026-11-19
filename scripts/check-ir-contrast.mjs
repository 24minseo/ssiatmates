import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import ts from "typescript";

const dir = path.resolve("node_modules/.cache/ir-contrast-tests");
await fs.mkdir(dir, { recursive: true });
for (const name of ["ir-html-contrast.server", "ir-html-render.server"]) {
  const source = await fs.readFile(`src/lib/${name}.ts`, "utf8");
  const output = ts
    .transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    })
    .outputText.replaceAll('"./ir-html-contrast.server"', '"./ir-html-contrast.server.mjs"');
  await fs.writeFile(path.join(dir, name + ".mjs"), output);
}
const { acceptResidualContrast } = await import(
  pathToFileURL(path.join(dir, "ir-html-contrast.server.mjs")).href
);
const { createRenderHandler } = await import(
  pathToFileURL(path.join(dir, "ir-html-render.server.mjs")).href
);
const job = "11111111-1111-4111-8111-111111111111",
  documentId = "22222222-2222-4222-8222-222222222222",
  claim = "33333333-3333-4333-8333-333333333333";
const oldHash = "a".repeat(32),
  newHash = "b".repeat(32);
const slides = Array.from({ length: 7 }, (_, i) => ({
  slideId: `slide-${i + 1}`,
  sectionLabel: "Business",
  headline: "제목",
  html: `<section class="ir-slide" data-slide-id="slide-${i + 1}"><p>본문</p></section>`,
  css: `.ir-slide[data-slide-id="slide-${i + 1}"]{color:var(--ir-ink)}`,
  imageSlots: [],
}));
const document = {
  schemaVersion: "ir_html_v1",
  canvas: { width: 1920, height: 1080 },
  designTokens: {
    colors: { CANVAS: "#FFFFFF", INK: "#555559", TITLE: "#252528", ON_ACCENT: "#FAFAFA" },
  },
  slides,
};
const report = {
  passed: false,
  fonts_loaded: true,
  slide_count: 7,
  contrast_scope: "solid_background_html_text_only",
  semantic_accuracy_verified: false,
  slides: slides.map((s, i) => ({
    slideId: s.slideId,
    passed: i !== 1,
    issues: i === 1 ? [{ code: "LOW_TEXT_CONTRAST", tag: "P" }] : [],
    contrast_checked: 1,
    contrast_unchecked: 0,
    text_nodes: 1,
  })),
};
const accepted = acceptResidualContrast(report);
assert.equal(accepted.passed, true);
assert.equal(accepted.contrast_remaining, 1);
assert.equal(accepted.warnings, undefined);
const overflow = structuredClone(report);
overflow.slides[2].issues.push({ code: "TEXT_OUTSIDE_SLIDE", tag: "P" });
assert.equal(acceptResidualContrast(overflow).passed, false);
assert.equal(acceptResidualContrast({ ...report, fonts_loaded: false }).passed, false);

const patched = structuredClone(document);
patched.slides[1].html = patched.slides[1].html.replace(
  "<p>",
  '<p style="color: rgb(85, 85, 89);">',
);
const environment = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "server-key",
  IR_HTML_RENDER_SECRET: "x".repeat(64),
};
for (const mode of ["correct", "no-change", "save-fails", "replay"]) {
  const calls = [];
  const candidate = {
    job_id: job,
    document_id: documentId,
    document_md5: mode === "replay" ? newHash : oldHash,
    image_revision: 0,
    document: mode === "replay" ? patched : document,
    validation: {
      validator_version: "ir_html_static_v1",
      security_checked: true,
      render_checked: false,
      ...(mode === "replay" ? { contrast_source_md5: oldHash } : {}),
    },
  };
  const handler = createRenderHandler(environment, {
    fonts: async () => "",
    browser: async () => ({
      newPage: async () => ({
        setViewport: async () => {},
        setJavaScriptEnabled: async () => {},
        setRequestInterception: async () => {},
        on: () => {},
        setDefaultTimeout: () => {},
        setContent: async () => {},
        evaluate: async (fn) =>
          fn.name === "correctContrastInPage"
            ? {
                changedSlides: ["correct", "save-fails"].includes(mode)
                  ? [{ slideId: "slide-2", html: patched.slides[1].html }]
                  : [],
                correctedTextBlocks: mode === "correct" ? 1 : 0,
              }
            : report,
        close: async () => {},
      }),
      close: async () => {},
    }),
    fetcher: async (url, init) => {
      const body = JSON.parse(init.body);
      calls.push({ url, body });
      if (url.endsWith("get_ir_html_render_candidate_v1")) return Response.json(candidate);
      if (url.endsWith("ir-deck-html-validate-v1")) {
        assert.equal(body.document.slides[1].html, patched.slides[1].html);
        return Response.json({ valid: true, job_id: job, claim_token: claim, document: patched });
      }
      if (url.endsWith("save_ir_html_contrast_v2")) {
        assert.equal(body.p_expected_document_md5, oldHash);
        return mode === "save-fails"
          ? Response.json({ error: "test" }, { status: 503 })
          : Response.json({
              saved: true,
              document_id: documentId,
              document_md5: newHash,
              image_revision: 0,
            });
      }
      throw Error("unexpected URL");
    },
  });
  const response = await handler(
    new Request("https://local/render", {
      method: "POST",
      headers: { "x-ir-render-secret": environment.IR_HTML_RENDER_SECRET },
      body: JSON.stringify({
        job_id: job,
        document_id: documentId,
        document_md5: oldHash,
        claim_token: claim,
      }),
    }),
  );
  const result = await response.json();
  if (mode === "save-fails") {
    assert.equal(result.render_ok, false);
    assert.equal(response.status, 503);
  } else {
    assert.equal(result.render_ok, true);
    assert.equal(result.report.contrast_policy, "auto_then_accept_v2");
    assert.equal(result.report.contrast_remaining, 1);
    assert.equal(result.warnings, undefined);
    assert.equal(result.document_md5, mode === "no-change" ? oldHash : newHash);
    assert.equal(result.source_document_md5, oldHash);
    assert.equal(result.contrast_saved, mode !== "no-change");
    assert.equal(result.report.contrast_correction, undefined);
  }
  assert.ok(calls.every((c) => !c.url.includes("deepseek")));
}
console.log(
  "PASS contrast policy: only residual contrast is nonblocking; overflow/fonts remain blocking; corrected HTML revalidated and persisted; save failures block; no-change/replay identities work; no AI calls or UI warnings.",
);
