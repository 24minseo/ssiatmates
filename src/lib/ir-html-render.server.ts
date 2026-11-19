// 서버 전용. 프론트 컴포넌트에서 import하지 않습니다.
import { timingSafeEqual } from "node:crypto";
import type { Browser } from "puppeteer-core";

type Slide = { slideId: string; html: string; css: string };
type DeckDocument = {
  schemaVersion: string;
  canvas: { width: number; height: number };
  designTokens: { colors: Record<string, string | null> };
  slides: Slide[];
};
type RenderBody = {
  job_id: string;
  document_id: string;
  claim_token: string;
  document_md5: string;
};
type Candidate = {
  job_id: string;
  document_id: string;
  document_md5: string;
  image_revision: number;
  document: DeckDocument;
  validation: {
    validator_version: string;
    security_checked: boolean;
    render_checked: boolean;
  };
};
type Env = Record<string, string | undefined>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PACK = `https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.${process.arch === "arm64" ? "arm64" : "x64"}.tar`;
const FONT_URLS = {
  Pretendard:
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  Paperlogy: "https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/Paperlogy-7Bold.woff2",
};
const object = (v: unknown) => v !== null && typeof v === "object" && !Array.isArray(v);
let active = false;
let fontsPromise: Promise<string> | undefined;
async function readBytes(stream: ReadableStream<Uint8Array> | null, limit: number) {
  if (!stream) throw new Error("body_missing");
  let size = 0;
  const parts: Uint8Array[] = [];
  const reader = stream.getReader();
  try {
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new Error("body_too_large");
      }
      parts.push(r.value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
async function jsonResponse<T>(response: Response, limit: number): Promise<T> {
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(await readBytes(response.body, limit)),
  ) as T;
}
async function defaultFonts(): Promise<string> {
  if (!fontsPromise)
    fontsPromise = (async () => {
      const faces = await Promise.all(
        Object.entries(FONT_URLS).map(async ([family, url]) => {
          const r = await fetch(url, {
            signal: AbortSignal.timeout(20000),
            redirect: "error",
          });
          if (!r.ok) {
            await r.body?.cancel();
            throw new Error("font_unavailable");
          }
          const data = await readBytes(r.body, 4 * 1024 * 1024);
          if (data.length < 100 || new TextDecoder().decode(data.slice(0, 4)) !== "wOF2")
            throw new Error("invalid_font");
          return `@font-face{font-family:'${family}';font-style:normal;font-weight:${family === "Pretendard" ? "100 900" : "700"};src:url(data:font/woff2;base64,${Buffer.from(data).toString("base64")}) format('woff2');font-display:block;}`;
        }),
      );
      return faces.join("\n");
    })().catch((e) => {
      fontsPromise = undefined;
      throw e;
    });
  return fontsPromise;
}
async function defaultBrowser(env: Env): Promise<Browser> {
  const { default: puppeteer } = await import("puppeteer-core");
  if (env["IR_HTML_LOCAL_CHROME"])
    return puppeteer.launch({
      executablePath: env["IR_HTML_LOCAL_CHROME"],
      headless: true,
      args: ["--disable-background-networking", "--disable-default-apps", "--no-first-run"],
      timeout: 30000,
    });
  const { default: chromium } = await import("@sparticuz/chromium-min");
  chromium.setGraphicsMode = false;
  const executablePath = await chromium.executablePath(PACK);
  return puppeteer.launch({
    executablePath,
    headless: "shell",
    args: chromium.args.filter(
      (a: string) => a !== "--disable-web-security" && a !== "--allow-running-insecure-content",
    ),
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    timeout: 30000,
  });
}
function validCandidate(c: Candidate, body: RenderBody) {
  if (
    !object(c) ||
    c.job_id !== body.job_id ||
    c.document_id !== body.document_id ||
    c.document_md5 !== body.document_md5 ||
    c.image_revision !== 0 ||
    c.validation?.validator_version !== "ir_html_static_v1" ||
    c.validation?.security_checked !== true ||
    c.validation?.render_checked !== false
  )
    throw new Error("candidate_identity");
  const d = c.document;
  if (
    !object(d) ||
    d.schemaVersion !== "ir_html_v1" ||
    d.canvas?.width !== 1920 ||
    d.canvas?.height !== 1080 ||
    !Array.isArray(d.slides) ||
    d.slides.length !== 7 ||
    !object(d.designTokens?.colors)
  )
    throw new Error("candidate_document");
  const ids = new Set();
  for (const s of d.slides) {
    if (
      !object(s) ||
      typeof s.slideId !== "string" ||
      !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(s.slideId) ||
      ids.has(s.slideId) ||
      typeof s.html !== "string" ||
      typeof s.css !== "string" ||
      s.css.includes("<")
    )
      throw new Error("candidate_slide");
    ids.add(s.slideId);
  }
  for (const [name, color] of Object.entries(d.designTokens.colors)) {
    if (
      !/^[A-Z_]+$/.test(name) ||
      (color !== null && (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)))
    )
      throw new Error("candidate_tokens");
  }
  return d;
}
export function assembleHtml(document: DeckDocument, fontCss: string) {
  const vars = Object.entries(document.designTokens.colors)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `--ir-${k.toLowerCase().replaceAll("_", "-")}:${v};`)
    .join("");
  const csp =
    "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>
 ${fontCss}
 *{box-sizing:border-box}html,body{margin:0;padding:0;background:var(--ir-canvas);font-family:Pretendard,sans-serif}
 :root{${vars}}
 .ir-host-page{position:relative;width:1920px;height:1080px;margin:0;padding:0;background:var(--ir-canvas);break-after:page}
 .ir-host-page>section.ir-slide{width:1920px;height:1080px;position:relative;margin:0;box-sizing:border-box}
 ${document.slides.map((s) => s.css).join("\n")}
 </style></head><body>${document.slides.map((s) => `<div class="ir-host-page">${s.html}</div>`).join("")}</body></html>`;
}
// Runs via DevTools, not as model-generated JavaScript inside the page.
export async function measureInPage() {
  const fonts = await Promise.all([
    document.fonts.load("500 26px Pretendard", "사업계획서 SSIAT"),
    document.fonts.load("700 56px Paperlogy", "사업계획서 SSIAT"),
  ]);
  await document.fonts.ready;
  const fontsLoaded = fonts.every((f) => f.length > 0);
  const color = (str: string): number[] | null => {
    const m = str.match(
      /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/,
    );
    return m
      ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])]
      : null;
  };
  const blend = (fg: number[], bg: number[]) =>
    [0, 1, 2].map((i) => fg[i]! * fg[3]! + bg[i]! * (1 - fg[3]!)).concat(1);
  const lum = (rgb: number[]) =>
    rgb
      .slice(0, 3)
      .map((n) => n / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
      .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i]!, 0);
  const bgFor = (element: Element): number[] | null => {
    const chain: Element[] = [];
    for (let e: Element | null = element; e; e = e.parentElement) chain.push(e);
    let bg = [255, 255, 255, 1];
    for (const e of chain.reverse()) {
      const st = getComputedStyle(e);
      if (st.backgroundImage !== "none" || st.opacity !== "1" || st.mixBlendMode !== "normal")
        return null;
      const c = color(st.backgroundColor);
      if (!c) return null;
      bg = blend(c, bg);
    }
    return bg;
  };
  const roots = Array.from(document.querySelectorAll(".ir-host-page > section.ir-slide"));
  const slides = roots.map((root) => {
    const rect = root.getBoundingClientRect(),
      issues: { code: string; tag?: string }[] = [];
    let contrastChecked = 0,
      contrastUnchecked = 0,
      textNodes = 0;
    const issue = (code: string, element?: Element) => {
      if (issues.length < 30 && !issues.some((i) => i.code === code && i.tag === element?.tagName))
        issues.push({ code, ...(element ? { tag: element.tagName } : {}) });
    };
    if (Math.abs(rect.width - 1920) > 1 || Math.abs(rect.height - 1080) > 1) issue("CANVAS_SIZE");
    const outside = (r: DOMRect) =>
      r.width > 0 &&
      r.height > 0 &&
      (r.left < rect.left - 1 ||
        r.top < rect.top - 1 ||
        r.right > rect.right + 1 ||
        r.bottom > rect.bottom + 1);
    for (const e of Array.from(root.querySelectorAll("*"))) {
      const st = getComputedStyle(e);
      if (st.display === "none" || st.visibility === "hidden") continue;
      if (e.closest("defs")) continue;
      if (outside(e.getBoundingClientRect())) issue("ELEMENT_OUTSIDE_SLIDE", e);
      if (
        e instanceof HTMLElement &&
        e.clientWidth > 0 &&
        e.clientHeight > 0 &&
        ((["hidden", "clip", "scroll", "auto"].includes(st.overflowX) &&
          e.scrollWidth > e.clientWidth + 2) ||
          (["hidden", "clip", "scroll", "auto"].includes(st.overflowY) &&
            e.scrollHeight > e.clientHeight + 2))
      )
        issue("CONTENT_OVERFLOW", e);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim() || !node.parentElement || node.parentElement.closest("defs"))
        continue;
      const parent = node.parentElement,
        st = getComputedStyle(parent);
      if (st.display === "none" || st.visibility === "hidden") continue;
      textNodes++;
      if (Number(st.opacity) === 0) issue("INVISIBLE_TEXT", parent);
      const range = document.createRange();
      range.selectNodeContents(node);
      const rs = Array.from(range.getClientRects());
      if (!rs.some((r) => r.width > 0 && r.height > 0)) {
        issue("INVISIBLE_TEXT", parent);
        continue;
      }
      if (rs.some(outside)) issue("TEXT_OUTSIDE_SLIDE", parent);
      for (let e: Element | null = parent; e && e !== root; e = e.parentElement) {
        const es = getComputedStyle(e),
          er = e.getBoundingClientRect();
        if (
          (["hidden", "clip", "scroll", "auto"].includes(es.overflowX) &&
            rs.some((r) => r.left < er.left - 1 || r.right > er.right + 1)) ||
          (["hidden", "clip", "scroll", "auto"].includes(es.overflowY) &&
            rs.some((r) => r.top < er.top - 1 || r.bottom > er.bottom + 1))
        )
          issue("CLIPPED_TEXT", e);
      }
      const fg = color(st.color),
        bg = bgFor(parent);
      if (!fg || !bg || parent.namespaceURI === "http://www.w3.org/2000/svg") {
        contrastUnchecked++;
        continue;
      }
      contrastChecked++;
      const actual = blend(fg, bg),
        a = lum(actual),
        b = lum(bg);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        threshold = parseFloat(st.fontSize) >= 40 ? 3 : 4.5;
      if (ratio + 0.01 < threshold) issue("LOW_TEXT_CONTRAST", parent);
    }
    if (!textNodes) issue("NO_VISIBLE_TEXT");
    return {
      slideId: root.getAttribute("data-slide-id"),
      passed: issues.length === 0,
      issues,
      contrast_checked: contrastChecked,
      contrast_unchecked: contrastUnchecked,
      text_nodes: textNodes,
    };
  });
  return {
    passed: fontsLoaded && slides.length === 7 && slides.every((s) => s.passed),
    fonts_loaded: fontsLoaded,
    slide_count: slides.length,
    slides,
    contrast_scope: "solid_background_html_text_only",
    semantic_accuracy_verified: false,
  };
}
export async function inspectWithBrowser(
  browser: Browser,
  document: DeckDocument,
  fontCss: string,
) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const u = request.url();
      if (u === "about:blank" || u.startsWith("data:")) void request.continue().catch(() => {});
      else void request.abort("blockedbyclient").catch(() => {});
    });
    page.setDefaultTimeout(25000);
    await page.setContent(assembleHtml(document, fontCss), {
      waitUntil: "load",
      timeout: 25000,
    });
    return await page.evaluate(measureInPage);
  } finally {
    await page.close();
  }
}
export function createRenderHandler(
  env: Env,
  deps: {
    fetcher?: typeof fetch;
    browser?: () => Promise<Browser>;
    fonts?: () => Promise<string>;
  } = {},
) {
  const fetcher = deps.fetcher ?? fetch;
  return async (request: Request): Promise<Response> => {
    const reply = (v: Record<string, unknown>, status = 200) =>
      new Response(JSON.stringify(v), {
        status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    if (request.method !== "POST")
      return reply({ render_ok: false, error_code: "METHOD_NOT_ALLOWED" }, 405);
    const secret = env["IR_HTML_RENDER_SECRET"] ?? "",
      key = env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
      base = (env["SUPABASE_URL"] ?? "").replace(/\/$/, "");
    if (secret.length < 32 || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base))
      return reply({ render_ok: false, error_code: "SERVER_NOT_CONFIGURED" }, 503);
    const received = Buffer.from(request.headers.get("x-ir-render-secret") ?? ""),
      expectedSecret = Buffer.from(secret);
    if (received.length !== expectedSecret.length || !timingSafeEqual(received, expectedSecret))
      return reply({ render_ok: false, error_code: "SERVER_ONLY" }, 403);
    let body: RenderBody;
    try {
      body = JSON.parse(new TextDecoder().decode(await readBytes(request.body, 4096)));
    } catch {
      return reply({ render_ok: false, error_code: "INVALID_REQUEST" }, 400);
    }
    if (
      !object(body) ||
      ![body.job_id, body.document_id, body.claim_token].every(
        (v) => typeof v === "string" && UUID.test(v),
      ) ||
      typeof body.document_md5 !== "string" ||
      !/^[a-f0-9]{32}$/.test(body.document_md5)
    )
      return reply({ render_ok: false, error_code: "INVALID_REQUEST" }, 400);
    const identity = {
      job_id: body.job_id,
      document_id: body.document_id,
      document_md5: body.document_md5,
    };
    if (active)
      return reply(
        {
          ...identity,
          render_ok: false,
          error_code: "WORKFLOW_FAILED",
          reason: "render_worker_busy",
        },
        503,
      );
    active = true;
    let browser: Browser | undefined;
    const start = Date.now();
    try {
      const r = await fetcher(base + "/rest/v1/rpc/get_ir_html_render_candidate_v1", {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_document_id: body.document_id,
          p_claim_token: body.claim_token,
        }),
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      });
      if (!r.ok) {
        await r.body?.cancel();
        return reply({
          ...identity,
          render_ok: false,
          error_code: "WORKFLOW_FAILED",
          reason: "candidate_unavailable",
        });
      }
      const candidate = await jsonResponse<Candidate>(r, 9 * 1024 * 1024),
        document = validCandidate(candidate, body);
      const fontCss = await (deps.fonts ?? defaultFonts)();
      browser = await (deps.browser ?? (() => defaultBrowser(env)))();
      const report = await inspectWithBrowser(browser, document, fontCss);
      const overflow = report.slides.some((s) =>
        s.issues.some((i) =>
          [
            "ELEMENT_OUTSIDE_SLIDE",
            "CONTENT_OVERFLOW",
            "TEXT_OUTSIDE_SLIDE",
            "CLIPPED_TEXT",
          ].includes(i.code),
        ),
      );
      return reply({
        ...identity,
        render_ok: report.passed,
        render_checked: true,
        renderer_version: "ir_html_browser_v1",
        image_revision: candidate.image_revision,
        report,
        elapsed_ms: Date.now() - start,
        ...(report.passed
          ? {}
          : {
              error_code: overflow ? "HTML_OVERFLOW" : "HTML_VALIDATION_FAILED",
            }),
      });
    } catch {
      return reply(
        {
          ...identity,
          render_ok: false,
          error_code: "WORKFLOW_FAILED",
          reason: "browser_validation_unavailable",
        },
        503,
      );
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {
          /* 브라우저 종료 오류를 성공으로 바꾸지 않습니다. */
        }
      }
      active = false;
    }
  };
}
export const handleIrHtmlRender = createRenderHandler(process.env);
