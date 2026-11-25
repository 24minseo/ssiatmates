// 서버 전용 HTML 덱 출력. 사용자 HTML/URL을 직접 받지 않고 고정된 문서 ID로 조회합니다.
import { createHash, timingSafeEqual } from "node:crypto";
import { acceptResidualContrast, acceptResidualVisualIssues } from "./ir-html-contrast.server";
import type { Browser } from "puppeteer-core";
import { prepareSlideText } from "./ir-slide-text";
import { takeSlideText } from "./ir-pptx-text.server";
import {
  assembleHtml,
  defaultBrowser,
  defaultFonts,
  measureInPage,
  type DeckDocument,
} from "./ir-html-render.server";
import {
  composeImagesInPage,
  prepareImageComposition,
  type ImageComposition,
  type ImageSnapshot,
} from "./ir-html-images.server";

type Env = Record<string, string | undefined>;
type ExportBody = { export_id: string; claim_token: string; snapshot_md5: string };
type ExportInput = {
  export_id: string;
  document_id: string;
  format: "pdf" | "pptx";
  snapshot_md5: string;
  image_revision: number;
  bucket: string;
  output_path: string;
  snapshot: ImageSnapshot & {
    schemaVersion: string;
    document: DeckDocument;
    imageRevision: number;
    emptyImagePolicy: string;
    pptxMode: string;
  };
};
const MAX_FILE = 20 * 1024 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MIME = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const CODES = new Set([
  "EXPORT_TIMEOUT",
  "EXPORT_RENDER_FAILED",
  "EXPORT_IMAGE_INVALID",
  "EXPORT_UPLOAD_FAILED",
  "EXPORT_TOO_LARGE",
  "EXPORT_VALIDATION_FAILED",
]);
let active = false;
async function bytesFrom(response: Response, max: number) {
  if (!response.body) throw new Error("EXPORT_RENDER_FAILED");
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      total += r.value.byteLength;
      if (total > max) {
        await reader.cancel();
        throw new Error("EXPORT_TOO_LARGE");
      }
      parts.push(r.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(parts, total);
}
function validInput(value: ExportInput, body: ExportBody) {
  if (
    !value ||
    value.export_id !== body.export_id ||
    value.snapshot_md5 !== body.snapshot_md5 ||
    !UUID.test(value.document_id) ||
    !["pdf", "pptx"].includes(value.format) ||
    value.bucket !== "ir-deck-html-exports-v1" ||
    !Number.isInteger(value.image_revision) ||
    value.image_revision < 0
  )
    throw new Error("EXPORT_VALIDATION_FAILED");
  const path = value.output_path.split("/");
  if (
    path.length !== 4 ||
    !UUID.test(path[0] ?? "") ||
    !UUID.test(path[1] ?? "") ||
    path[2] !== body.export_id ||
    path[3] !== `result.${value.format}`
  ) {
    throw new Error("EXPORT_VALIDATION_FAILED");
  }
  const s = value.snapshot;
  const d = s?.document;
  if (
    s?.schemaVersion !== "ir_html_export_snapshot_v1" ||
    s.imageRevision !== value.image_revision ||
    s.emptyImagePolicy !== "preserve_geometry_hide_upload_ui" ||
    !["image_slides", "editable_text_v1"].includes(s.pptxMode) ||
    d?.schemaVersion !== "ir_html_v1" ||
    d.canvas?.width !== 1920 ||
    d.canvas?.height !== 1080 ||
    !Array.isArray(d.slides) ||
    d.slides.length !== 7 ||
    !d.designTokens?.colors ||
    !Array.isArray(s.imageSlots) ||
    !Array.isArray(s.assets)
  )
    throw new Error("EXPORT_VALIDATION_FAILED");
  for (const slide of d.slides) {
    if (
      !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(slide.slideId) ||
      typeof slide.html !== "string" ||
      typeof slide.css !== "string" ||
      slide.css.includes("<")
    )
      throw new Error("EXPORT_VALIDATION_FAILED");
  }
  for (const [name, color] of Object.entries(d.designTokens.colors)) {
    if (!/^[A-Z_]+$/.test(name) || (color !== null && !/^#[a-f0-9]{6}$/i.test(color))) {
      throw new Error("EXPORT_VALIDATION_FAILED");
    }
  }
  for (const asset of s.assets) {
    if (!asset.objectPath.startsWith(`${path[0]}/${path[1]}/`))
      throw new Error("EXPORT_IMAGE_INVALID");
  }
  return value;
}

export async function renderExportFile(
  browser: Browser,
  document: DeckDocument,
  images: ImageComposition,
  format: "pdf" | "pptx",
  fontCss: string,
) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (r) => {
      if (r.url() === "about:blank" || r.url().startsWith("data:"))
        void r.continue().catch(() => {});
      else void r.abort("blockedbyclient").catch(() => {});
    });
    page.setDefaultTimeout(25000);
    await page.emulateMediaType("screen");
    await page.setContent(assembleHtml(document, fontCss), { waitUntil: "load", timeout: 25000 });
    const slides = await page.$$(".ir-host-page > section.ir-slide");
    for (const [index, slide] of slides.entries())
      await slide.evaluate(prepareSlideText, document.slides[index]?.textEdits ?? {});
    await page.evaluate(composeImagesInPage, images);
    // Only saved ready documents reach this export path. Do not block a deck
    // already accepted after its single repair because it still has visual defects.
    const report = acceptResidualVisualIssues(
      acceptResidualContrast(await page.evaluate(measureInPage)),
    );
    if (!report.passed || !report.fonts_loaded || report.slide_count !== 7) {
      throw new Error("EXPORT_VALIDATION_FAILED");
    }
    let result: Uint8Array;
    if (format === "pdf") {
      await page.addStyleTag({
        content:
          "@page{size:1920px 1080px;margin:0}.ir-host-page:last-child{break-after:auto}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}",
      });
      result = await page.pdf({
        width: "1920px",
        height: "1080px",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, left: 0, bottom: 0, right: 0 },
        timeout: 25000,
      });
    } else {
      const { default: PptxGenJS } = await import("pptxgenjs");
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.author = "SSIAT";
      pptx.subject = "IR 덱";
      pptx.title = "IR Deck";
      const roots = await page.$$(".ir-host-page");
      if (roots.length !== 7) throw new Error("EXPORT_VALIDATION_FAILED");
      let imageBytes = 0;
      for (const root of roots) {
        const boxes = await root.evaluate(takeSlideText);
        const image = await root.screenshot({ type: "jpeg", quality: 94 });
        imageBytes += image.byteLength;
        if (imageBytes > MAX_FILE) throw new Error("EXPORT_TOO_LARGE");
        const slide = pptx.addSlide();
        slide.addImage({
          data: `image/jpeg;base64,${Buffer.from(image).toString("base64")}`,
          x: 0,
          y: 0,
          w: 13.333333,
          h: 7.5,
        });
        for (const box of boxes) {
          slide.addText(box.runs, {
            x: box.x, y: box.y, w: Math.max(0.01,box.w), h: Math.max(0.01,box.h),
            margin: 0, valign: "top", align: box.align, wrap: false,
            ...(Number.isFinite(box.lineHeight) ? { lineSpacing: box.lineHeight } : {}),
            paraSpaceAfter: 0, paraSpaceBefore: 0, lang: "ko-KR",
          });
        }
      }
      const output = await pptx.write({ outputType: "nodebuffer", compression: true });
      if (!(output instanceof Uint8Array)) throw new Error("EXPORT_RENDER_FAILED");
      result = output;
    }
    if (result.byteLength === 0 || result.byteLength > MAX_FILE)
      throw new Error("EXPORT_TOO_LARGE");
    return { bytes: Buffer.from(result), report };
  } finally {
    await page.close();
  }
}

export function createExportHandler(
  env: Env,
  deps: {
    fetcher?: typeof fetch;
    browser?: () => Promise<Browser>;
    fonts?: () => Promise<string>;
    render?: typeof renderExportFile;
  } = {},
) {
  const fetcher = deps.fetcher ?? fetch;
  return async (request: Request): Promise<Response> => {
    const reply = (v: Record<string, unknown>, status = 200) =>
      new Response(JSON.stringify(v), {
        status,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    if (request.method !== "POST")
      return reply({ ready: false, error_code: "METHOD_NOT_ALLOWED" }, 405);
    const base = (env["SUPABASE_URL"] ?? "").replace(/\/$/, "");
    const key = env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
    const secret = env["IR_HTML_RENDER_SECRET"] ?? "";
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base) || !key || secret.length < 32) {
      return reply({ ready: false, error_code: "SERVER_NOT_CONFIGURED" }, 503);
    }
    const received = Buffer.from(request.headers.get("x-ir-render-secret") ?? "");
    const expected = Buffer.from(secret);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      return reply({ ready: false, error_code: "SERVER_ONLY" }, 403);
    }
    let body: ExportBody;
    try {
      body = JSON.parse((await bytesFrom(new Response(request.body), 4096)).toString("utf8"));
      if (
        !body ||
        !UUID.test(body.export_id) ||
        !UUID.test(body.claim_token) ||
        !/^[a-f0-9]{32}$/.test(body.snapshot_md5)
      )
        throw new Error();
    } catch {
      return reply({ ready: false, error_code: "INVALID_REQUEST" }, 400);
    }
    if (active) return reply({ ready: false, error_code: "EXPORT_WORKER_BUSY" }, 503);
    active = true;
    const deadline = Date.now() + 100000;
    const signal = (maximum: number) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error("EXPORT_TIMEOUT");
      return AbortSignal.timeout(Math.min(maximum, remaining));
    };
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const rpc = async (name: string, value: Record<string, unknown>, limit = 65536) => {
      const r = await fetcher(`${base}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(value),
        redirect: "error",
        signal: signal(15000),
      });
      if (!r.ok) {
        await r.body?.cancel();
        throw new Error("EXPORT_RENDER_FAILED");
      }
      return JSON.parse((await bytesFrom(r, limit)).toString("utf8"));
    };
    let browser: Browser | undefined;
    let renderTimedOut = false;
    const watchdog = setTimeout(() => {
      renderTimedOut = true;
      void browser?.close().catch(() => {});
    }, 90000);
    watchdog.unref();
    let inputValidated = false;
    let completing = false;
    const started = Date.now();
    try {
      const input = validInput(
        (await rpc(
          "get_ir_html_export_render_input_v1",
          {
            p_export_id: body.export_id,
            p_claim_token: body.claim_token,
          },
          11 * 1024 * 1024,
        )) as ExportInput,
        body,
      );
      inputValidated = true;
      const outputUrl = `${base}/storage/v1/object/${input.bucket}/${input.output_path}`;
      // 저장 후 완료 응답을 받지 못한 경우 기존 파일을 재사용합니다.
      const existing = await fetcher(outputUrl, {
        headers,
        redirect: "error",
        signal: signal(15000),
      });
      let bytes: Buffer;
      let reusedFile = false;
      if (existing.ok) {
        if (existing.headers.get("content-type")?.split(";")[0] !== MIME[input.format]) {
          await existing.body?.cancel();
          throw new Error("EXPORT_UPLOAD_FAILED");
        }
        bytes = await bytesFrom(existing, MAX_FILE);
        if (
          (input.format === "pdf" && bytes.subarray(0, 5).toString() !== "%PDF-") ||
          (input.format === "pptx" && bytes.subarray(0, 4).toString("hex") !== "504b0304")
        ) {
          throw new Error("EXPORT_UPLOAD_FAILED");
        }
        reusedFile = true;
      } else {
        const absent = existing.status === 404 || existing.status === 400;
        await existing.body?.cancel();
        if (!absent) throw new Error("EXPORT_UPLOAD_FAILED");
        const [images, fonts] = await Promise.all([
          prepareImageComposition(input.snapshot, async (a) => {
            const r = await fetcher(
              `${base}/storage/v1/object/ir-deck-editor-assets-v2/${a.objectPath}`,
              {
                headers,
                redirect: "error",
                signal: signal(15000),
              },
            );
            if (!r.ok) {
              await r.body?.cancel();
              throw new Error("EXPORT_IMAGE_INVALID");
            }
            return bytesFrom(r, Math.min(a.bytes, 3145728));
          }),
          (deps.fonts ?? defaultFonts)(),
        ]);
        if (deadline - Date.now() < 30000 || renderTimedOut) throw new Error("EXPORT_TIMEOUT");
        browser = await (deps.browser ?? (() => defaultBrowser(env)))();
        if (renderTimedOut) throw new Error("EXPORT_TIMEOUT");
        bytes = (
          await (deps.render ?? renderExportFile)(
            browser,
            input.snapshot.document,
            images,
            input.format,
            fonts,
          )
        ).bytes;
        if (bytes.length === 0 || bytes.length > MAX_FILE) throw new Error("EXPORT_TOO_LARGE");
        const uploaded = await fetcher(outputUrl, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": MIME[input.format],
            "x-upsert": "false",
          },
          body: new Uint8Array(bytes),
          redirect: "error",
          signal: signal(20000),
        });
        const uploadedOk = uploaded.ok;
        await uploaded.body?.cancel();
        if (!uploadedOk) throw new Error("EXPORT_UPLOAD_FAILED");
      }
      completing = true;
      const result = await rpc("finish_ir_html_export_v1", {
        p_export_id: body.export_id,
        p_claim_token: body.claim_token,
        p_snapshot_md5: input.snapshot_md5,
        p_output_bytes: bytes.length,
        p_output_sha256: createHash("sha256").update(bytes).digest("hex"),
      });
      if (result?.ready !== true || result.export_id !== body.export_id)
        throw new Error("EXPORT_RENDER_FAILED");
      return reply({
        ready: true,
        export_id: body.export_id,
        format: input.format,
        image_revision: input.image_revision,
        reused_file: reusedFile,
        elapsed_ms: Date.now() - started,
      });
    } catch (error) {
      const code =
        renderTimedOut || Date.now() >= deadline
          ? "EXPORT_TIMEOUT"
          : error instanceof Error && CODES.has(error.message)
            ? error.message
            : "EXPORT_RENDER_FAILED";
      // 완료 API 통신 오류는 이미 완료됐을 수도 있으므로 실패로 덮어쓰지 않습니다.
      if (inputValidated && !completing) {
        try {
          await rpc("fail_ir_html_export_v1", {
            p_export_id: body.export_id,
            p_claim_token: body.claim_token,
            p_error_code: code,
          });
        } catch {
          /* 상태 조회 시 시간초과 복구 */
        }
      }
      return reply(
        {
          ready: false,
          export_id: body.export_id,
          error_code: code,
          completion_pending: completing,
        },
        503,
      );
    } finally {
      clearTimeout(watchdog);
      try {
        await browser?.close();
      } catch {
        /* 원래 출력 결과 유지 */
      }
      active = false;
    }
  };
}
export const handleIrHtmlExport = createExportHandler(process.env);
