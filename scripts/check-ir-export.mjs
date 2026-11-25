import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";

const compiled = path.resolve("node_modules/.cache/ir-export-check");
await fs.mkdir(compiled, { recursive: true });
for (const name of ["ir-slide-text", "ir-pptx-text.server", "ir-html-contrast.server", "ir-html-render.server", "ir-html-images.server", "ir-html-export.server"]) {
  const source = await fs.readFile(`src/lib/${name}.ts`, "utf8");
  const js = ts
    .transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    })
    .outputText.replace(/from "(\.\/ir-[^"]+)"/g, 'from "$1.mjs"');
  await fs.writeFile(path.join(compiled, name + ".mjs"), js);
}
const { createExportHandler, renderExportFile } = await import(
  pathToFileURL(path.join(compiled, "ir-html-export.server.mjs")).href
);
const { prepareImageComposition } = await import(
  pathToFileURL(path.join(compiled, "ir-html-images.server.mjs")).href
);
const ids = {
  export_id: "11111111-1111-4111-8111-111111111111",
  document_id: "22222222-2222-4222-8222-222222222222",
  claim_token: "33333333-3333-4333-8333-333333333333",
  snapshot_md5: "a".repeat(32),
};
const doc = {
  schemaVersion: "ir_html_v1",
  canvas: { width: 1920, height: 1080 },
  designTokens: { colors: { CANVAS: "#F7F7F8", INK: "#555559" } },
  slides: Array.from({ length: 7 }, (_, i) => ({
    slideId: `slide-${i}`,
    html: `<section class="ir-slide" data-slide-id="slide-${i}"><p>사업계획서 핵심 내용 ${i + 1}</p></section>`,
    css: `.ir-slide[data-slide-id="slide-${i}"]{padding:96px;color:var(--ir-ink);font-family:Pretendard;font-size:26px;line-height:1.4}`,
  })),
};
const snapshot = {
  schemaVersion: "ir_html_export_snapshot_v1",
  document: doc,
  imageRevision: 0,
  imageSlots: [],
  assets: [],
  emptyImagePolicy: "preserve_geometry_hide_upload_ui",
  pptxMode: "image_slides",
};
const input = {
  ...ids,
  format: "pdf",
  image_revision: 0,
  bucket: "ir-deck-html-exports-v1",
  output_path: `44444444-4444-4444-8444-444444444444/55555555-5555-4555-8555-555555555555/${ids.export_id}/result.pdf`,
  snapshot,
};
const env = {
  SUPABASE_URL: "https://local-export-check.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  IR_HTML_RENDER_SECRET: "test-export-secret-".repeat(4),
};
const request = (body = ids, secret = env.IR_HTML_RENDER_SECRET) =>
  new Request("https://local.test/api/internal/ir-html-export-v1", {
    method: "POST",
    headers: { "X-IR-Render-Secret": secret },
    body: JSON.stringify(body),
  });
let calls = [],
  stored = false,
  completionError = false,
  closed = 0,
  renderCount = 0,
  shouldFail = false;
const fakeFetch = async (url, options = {}) => {
  calls.push(String(url));
  if (String(url).endsWith("/get_ir_html_export_render_input_v1")) return Response.json(input);
  if (String(url).endsWith("/finish_ir_html_export_v1")) {
    if (completionError) throw new Error("network");
    const value = JSON.parse(options.body);
    assert.equal(value.p_output_bytes, 15);
    return Response.json({ ready: true, export_id: ids.export_id });
  }
  if (String(url).endsWith("/fail_ir_html_export_v1")) return Response.json({ recorded: true });
  if (String(url).includes("/storage/v1/object/")) {
    if (options.method === "POST") {
      stored = true;
      assert.equal(options.headers["x-upsert"], "false");
      return Response.json({ Key: "test" });
    }
    return stored
      ? new Response("%PDF-test-file!", { headers: { "Content-Type": "application/pdf" } })
      : new Response("missing", { status: 404 });
  }
  throw new Error("Unexpected network");
};
// Keep fixture size stable for byte-count assertion.
assert.equal(Buffer.byteLength("%PDF-test-file!"), 15);
const handler = createExportHandler(env, {
  fetcher: fakeFetch,
  browser: async () => ({
    close: async () => {
      closed++;
    },
  }),
  fonts: async () => "",
  render: async () => {
    renderCount++;
    if (shouldFail) throw new Error("EXPORT_VALIDATION_FAILED");
    return { bytes: Buffer.from("%PDF-test-file!"), report: {} };
  },
});
assert.equal((await handler(new Request("https://local.test"))).status, 405);
assert.equal((await handler(request(ids, "wrong"))).status, 403);
assert.equal(calls.length, 0);
assert.equal((await handler(request({}))).status, 400);
assert.equal(calls.length, 0);
let response = await handler(request());
assert.equal(response.status, 200);
assert.equal((await response.json()).ready, true);
assert.equal(renderCount, 1);
assert.equal(closed, 1);
response = await handler(request());
assert.equal((await response.json()).reused_file, true);
assert.equal(renderCount, 1);
completionError = true;
calls = [];
response = await handler(request());
assert.equal((await response.json()).completion_pending, true);
assert.ok(!calls.some((s) => s.endsWith("/fail_ir_html_export_v1")));
completionError = false;
stored = false;
shouldFail = true;
calls = [];
response = await handler(request());
assert.equal((await response.json()).error_code, "EXPORT_VALIDATION_FAILED");
assert.ok(calls.some((s) => s.endsWith("/fail_ir_html_export_v1")));
console.log(
  "PASS export route auth/input gates, private upload, file reuse, completion uncertainty, failure recording and browser cleanup.",
);
if (process.env.IR_EXPORT_BROWSER_TEST === "1") {
  const { default: puppeteer } = await import("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath:
      process.env.IR_HTML_LOCAL_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-crash-reporter", "--disable-breakpad"],
  });
  try {
    const font = await fs.readFile("C:/Windows/Fonts/malgun.ttf");
    const css = ["Pretendard", "Paperlogy"]
      .map(
        (f) =>
          `@font-face{font-family:${f};font-weight:100 900;src:url(data:font/ttf;base64,${font.toString("base64")}) format('truetype')}`,
      )
      .join("");
    const picture = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWXQAAAAASUVORK5CYII=",
      "base64",
    );
    const pictureId = "66666666-6666-4666-8666-666666666666";
    const actualSnapshot = structuredClone(snapshot);
    actualSnapshot.assets = [
      {
        assetId: pictureId,
        objectPath:
          "44444444-4444-4444-8444-444444444444/55555555-5555-4555-8555-555555555555/" +
          pictureId +
          "/source.png",
        mimeType: "image/png",
        bytes: picture.length,
        sha256: createHash("sha256").update(picture).digest("hex"),
      },
    ];
    actualSnapshot.imageSlots = [
      {
        id: "slot-0",
        slideId: "slide-0",
        origin: "generated",
        assetId: pictureId,
        fit: "contain",
        placement: null,
      },
      {
        id: "slot-1",
        slideId: "slide-1",
        origin: "generated",
        assetId: null,
        fit: "cover",
        placement: null,
      },
      {
        id: "user-image-1",
        slideId: "slide-6",
        origin: "user",
        assetId: pictureId,
        fit: "cover",
        placement: { x: 1100, y: 400, width: 400, height: 250, zIndex: 5 },
      },
    ];
    for (let i = 0; i < 2; i++)
      actualSnapshot.document.slides[i].html = actualSnapshot.document.slides[i].html.replace(
        "</section>",
        '<div data-image-slot-id="slot-' +
          i +
          '" style="position:absolute;left:96px;top:300px;width:400px;height:200px;background:gray;border:1px dashed"><div data-slot-placeholder-ui>이미지 업로드</div></div></section>',
      );
    const images = await prepareImageComposition(actualSnapshot, async () => picture);
    const actualDoc = actualSnapshot.document;
    actualDoc.slides[0].textEdits = { t0: { text: "편집한 발표 제목", colors: [{ start: 4, end: 6, color: "#fa3456" }], size: 54, bold: true, x: 90, y: 40 } };
    // Identical slides apart from the persisted group translation.
    for (const i of [2,3]) actualDoc.slides[i].html=actualDoc.slides[i].html.replace("<p>","<figure style='margin:0;background:#ddd'><p>").replace("</p>","</p></figure>");
    actualDoc.slides[3].groupEdits={g0:{x:48,y:96}};
    const pdf = await renderExportFile(browser, actualDoc, images, "pdf", css);
    assert.equal(pdf.bytes.subarray(0, 5).toString(), "%PDF-");
    assert.equal((pdf.bytes.toString("latin1").match(/\/Type \/Page\b/g) || []).length, 7);
    await fs.writeFile(path.resolve("../ir-export-sample.pdf"), pdf.bytes);
    const pptx = await renderExportFile(browser, actualDoc, images, "pptx", css);
    const require = createRequire(import.meta.url),
      JSZip = require("jszip");
    const zip = await JSZip.loadAsync(pptx.bytes);
    async function textPosition(page) {
      const xml=await zip.file("ppt/slides/slide"+page+".xml").async("string");
      const pos=xml.match(/<p:sp>[\s\S]*?<a:off x="(\d+)" y="(\d+)"/);
      return [Number(pos[1]),Number(pos[2])];
    }
    const base=await textPosition(3), shifted=await textPosition(4);
    assert.equal(shifted[0]-base[0],48*6350);
    assert.equal(shifted[1]-base[1],96*6350);
    for (let i=1; i<=7; i++) {
      const xml = await zip.file(`ppt/slides/slide${i}.xml`).async("string");
      assert.ok(xml.includes("<p:sp>"));
      if (i > 1) assert.ok(xml.includes(`사업계획서 핵심 내용 ${i}`));
      if (i === 1) {
        assert.match(xml, /<a:r>\s*<a:rPr\b(?:(?!<\/a:rPr>)[\s\S])*?fa3456[\s\S]*?<\/a:rPr>\s*<a:t>발표<\/a:t>/i);
        assert.match(xml, /sz="2700"/);
        assert.match(xml, /b="1"/);
      }
    }
    assert.equal(
      Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p)).length,
      7,
    );
    assert.equal(Object.keys(zip.files).filter((p) => /^ppt\/media\/.*\.jpeg$/.test(p)).length, 7);
    await fs.writeFile(path.resolve("../ir-export-sample.pptx"), pptx.bytes);
    console.log(
      `PASS actual Chromium: 7-page PDF (${pdf.bytes.length} bytes) and 7-slide PPTX (${pptx.bytes.length} bytes), fonts and layout checks.`,
    );
  } finally {
    await browser.close();
  }
}
