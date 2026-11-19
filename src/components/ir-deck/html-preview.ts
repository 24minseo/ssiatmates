import type { HtmlSlide, HtmlView } from "./html-api";

const fontCss = `@font-face{font-family:Pretendard;font-style:normal;font-weight:100 900;font-display:swap;src:url(https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2) format('woff2')}@font-face{font-family:Paperlogy;font-style:normal;font-weight:700;font-display:swap;src:url(https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/Paperlogy-7Bold.woff2) format('woff2')}`;

// HTML을 앱 DOM에 삽입하지 않는다. 서버 검사를 통과한 정적 문서만 opaque-origin iframe에서 표시한다.
export function previewHtml(
  slide: HtmlSlide,
  view: HtmlView,
  urls: Record<string, string>,
  nonce: string,
  channel: string,
  mediaOrigin: string,
  interactive: boolean,
): string {
  const parsed = new DOMParser().parseFromString(slide.html, "text/html");
  parsed
    .querySelectorAll(
      "script,iframe,object,embed,link,meta,base,form,input,button,textarea,foreignObject,animate,set",
    )
    .forEach((n) => n.remove());
  parsed.querySelectorAll("*").forEach((n) => {
    for (const a of Array.from(n.attributes)) {
      if (
        /^on/i.test(a.name) ||
        /^(?:src|srcset|href|xlink:href|action|formaction|nonce)$/i.test(a.name)
      )
        n.removeAttribute(a.name);
    }
  });
  const root = parsed.querySelector<HTMLElement>("section.ir-slide[data-slide-id]");
  if (!root || root.dataset["slideId"] !== slide.slideId)
    throw new Error("슬라이드 HTML을 확인하지 못했습니다.");
  for (const slot of view.imageSlots.filter((s) => s.slideId === slide.slideId)) {
    let host: HTMLElement | undefined;
    if (slot.origin === "generated") {
      host = Array.from(root.querySelectorAll<HTMLElement>("[data-image-slot-id]")).find(
        (n) => n.dataset["imageSlotId"] === slot.id,
      );
    } else if (slot.placement) {
      host = parsed.createElement("div");
      const p = slot.placement;
      Object.assign(host.style, {
        position: "absolute",
        left: `${p.x}px`,
        top: `${p.y}px`,
        width: `${p.width}px`,
        height: `${p.height}px`,
        zIndex: String(p.zIndex),
        overflow: "hidden",
      });
      host.dataset["imageSlotId"] = slot.id;
      root.append(host);
    }
    if (!host) continue;
    host.style.cursor = interactive ? "pointer" : "default";
    host.setAttribute("aria-label", slot.description || "이미지 업로드");
    if (!slot.assetId) continue;
    host.querySelectorAll("[data-slot-placeholder-ui]").forEach((n) => n.remove());
    host.style.setProperty("background", "transparent", "important");
    host.style.setProperty("border", "0", "important");
    const src = urls[slot.assetId];
    const isEmbeddedImage = /^data:image\//i.test(src || "");
    if (!src || (!isEmbeddedImage && new URL(src).origin !== mediaOrigin)) continue;
    const img = parsed.createElement("img");
    img.src = src;
    img.alt = slot.description;
    Object.assign(img.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      objectFit: slot.fit,
      display: "block",
      margin: "0",
      maxWidth: "none",
      maxHeight: "none",
    });
    host.append(img);
  }
  const vars = Object.entries(view.document.designTokens.colors)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `--ir-${k.toLowerCase().replaceAll("_", "-")}:${v};`)
    .join("");
  const csp = `default-src 'none'; script-src ${interactive ? `'nonce-${nonce}'` : "'none'"}; style-src 'unsafe-inline'; font-src https://cdn.jsdelivr.net; img-src ${mediaOrigin} data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  const safeCss = slide.css.replaceAll("<", "\\3c ");
  const bridge = interactive
    ? `<script nonce="${nonce}">document.addEventListener('click',function(e){e.preventDefault();var n=e.target.closest('[data-image-slot-id]');parent.postMessage({type:'ir-image-select',channel:${JSON.stringify(channel)},slideId:${JSON.stringify(slide.slideId)},slotId:n?n.getAttribute('data-image-slot-id'):null,x:Math.round(e.clientX),y:Math.round(e.clientY)},'*')});</script>`
    : "";
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${fontCss}:root{${vars}}*{box-sizing:border-box}html,body{margin:0;padding:0;width:1920px;height:1080px;overflow:hidden;background:var(--ir-canvas);font-family:Pretendard,sans-serif}.ir-host-page{position:relative;width:1920px;height:1080px;margin:0;padding:0;background:var(--ir-canvas)}section.ir-slide{width:1920px;height:1080px;position:relative;margin:0}:where([data-image-slot-id]){position:relative}${safeCss}</style></head><body><div class="ir-host-page">${root.outerHTML}</div>${bridge}</body></html>`;
}
