import type { HtmlSlide, HtmlView } from "./html-api";
import { prepareSlideText } from "@/lib/ir-slide-text";

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
  prepareSlideText(root, slide.textEdits);
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
    host.style.cursor = interactive ? (slot.origin === "user" ? "move" : "pointer") : "default";
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
      objectFit: slot.origin === "user" ? "contain" : slot.fit,
      display: "block",
      margin: "0",
      maxWidth: "none",
      maxHeight: "none",
    });
    host.append(img);
    if (interactive && slot.origin === "user") {
      const handle = parsed.createElement("div");
      handle.dataset["imageResizeHandle"] = "true";
      handle.setAttribute("aria-label", "이미지 크기 조절");
      host.append(handle);
    }
  }
  const vars = Object.entries(view.document.designTokens.colors)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `--ir-${k.toLowerCase().replaceAll("_", "-")}:${v};`)
    .join("");
  const csp = `default-src 'none'; script-src ${interactive ? `'nonce-${nonce}'` : "'none'"}; style-src 'unsafe-inline'; font-src https://cdn.jsdelivr.net; img-src ${mediaOrigin} data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  const safeCss = slide.css.replaceAll("<", "\\3c ");
  const bridge = interactive
    ? `<script nonce="${nonce}">
      (function(){
        var active = null;
        var movingText = null;
        function send(type, node, event) {
          parent.postMessage({
            type:type,
            channel:${JSON.stringify(channel)},
            slideId:${JSON.stringify(slide.slideId)},
            slotId:node ? node.getAttribute('data-image-slot-id') : null,
            x:Math.round(event.clientX),
            y:Math.round(event.clientY)
          },'*');
        }
        function number(value, fallback) {
          var parsed = Number.parseFloat(value);
          return Number.isFinite(parsed) ? parsed : fallback;
        }
        function clamp(value, min, max) {
          return Math.max(min, Math.min(max, value));
        }
        function updateDrag(e) {
          if(!active) return;
          var dx=e.clientX-active.startX;
          var dy=e.clientY-active.startY;
          var left=active.left;
          var top=active.top;
          var width=active.width;
          var height=active.height;
          if(active.mode === 'resize') {
            var ratio=active.width/active.height;
            var maxWidth=Math.min(1920-active.left, (1080-active.top)*ratio);
            width=clamp(active.width+dx, 80, maxWidth);
            height=width/ratio;
          } else {
            left=clamp(active.left+dx, 0, 1920-active.width);
            top=clamp(active.top+dy, 0, 1080-active.height);
          }
          active.node.style.left=Math.round(left)+'px';
          active.node.style.top=Math.round(top)+'px';
          active.node.style.width=Math.round(width)+'px';
          active.node.style.height=Math.round(height)+'px';
        }
        var textMode=false;
        window.addEventListener('message',function(e){
          var m=e.data;
          if(e.source!==parent || !m || m.channel!==${JSON.stringify(channel)} || m.type!=='ir-text-mode' || typeof m.enabled!=='boolean') return;
          textMode=m.enabled;
          if(movingText) movingText.block.style.translate=movingText.original;
          movingText=null;
        });
        document.addEventListener('pointerdown',function(e){
          if(e.button !== 0) return;
          var target=e.target instanceof Element ? e.target : null;
          if (textMode) {
            var block=target && target.closest('[data-ir-text]');
            if (block) {
              var css=getComputedStyle(block), offset=css.translate.split(' ');
              movingText={block:block,sx:e.clientX,sy:e.clientY,x:parseFloat(offset[0])||0,y:parseFloat(offset[1])||0,original:block.style.translate};
              e.preventDefault();
              block.setPointerCapture(e.pointerId);
            }
            return;
          }
          var resize=target && target.closest('[data-image-resize-handle]');
          var n=resize ? resize.closest('[data-image-slot-id]') : target && target.closest('[data-image-slot-id]');
          e.preventDefault();
          active=n ? {
            node:n,
            mode:resize ? 'resize' : 'move',
            startX:e.clientX,
            startY:e.clientY,
            left:number(n.style.left, 0),
            top:number(n.style.top, 0),
            width:number(n.style.width, 640),
            height:number(n.style.height, 360),
          } : null;
          if(n && n.setPointerCapture) n.setPointerCapture(e.pointerId);
          send(
            n ? (resize ? 'ir-image-resize-start' : 'ir-image-drag-start') : 'ir-image-select',
            n,
            e,
          );
        });
        document.addEventListener('pointermove',function(e){
          if(movingText) {
            var t=movingText;
            t.block.style.translate=(t.x+e.clientX-t.sx)+'px '+(t.y+e.clientY-t.sy)+'px';
            return;
          }
          if(!active) return;
          e.preventDefault();
          updateDrag(e);
          send(active.mode === 'resize' ? 'ir-image-resize-move' : 'ir-image-drag-move',active.node,e);
        });
        document.addEventListener('pointerup',function(e){
          if(movingText) {
            var t=movingText, css=getComputedStyle(t.block);
            t.block.style.translate=t.original;
            parent.postMessage({type:'ir-text-select',channel:${JSON.stringify(channel)},slideId:${JSON.stringify(slide.slideId)},
              id:t.block.dataset.irText,text:t.block.innerText,size:parseFloat(css.fontSize),bold:Number(css.fontWeight)>=600,
              dx:Math.round(e.clientX-t.sx),dy:Math.round(e.clientY-t.sy)},'*');
            movingText=null;
            return;
          }
          if(!active) return;
          e.preventDefault();
          updateDrag(e);
          send(active.mode === 'resize' ? 'ir-image-resize-end' : 'ir-image-drag-end',active.node,e);
          active=null;
        });
        document.addEventListener('pointercancel',function(){ active=null; if(movingText) movingText.block.style.translate=movingText.original; movingText=null; });
        document.addEventListener('keydown',function(e){
          if(e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          parent.postMessage({
            type:'ir-slide-shortcut',
            channel:${JSON.stringify(channel)},
            slideId:${JSON.stringify(slide.slideId)},
            key:e.key
          },'*');
        });
        document.addEventListener('wheel',function(e){
          if(Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
          e.preventDefault();
          parent.postMessage({
            type:'ir-slide-wheel',
            channel:${JSON.stringify(channel)},
            slideId:${JSON.stringify(slide.slideId)},
            deltaX:e.deltaX,
            deltaY:e.deltaY
          },'*');
        },{passive:false});
      })();
    </script>`
    : "";
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${fontCss}:root{${vars}}*{box-sizing:border-box}html,body{margin:0;padding:0;width:1920px;height:1080px;overflow:hidden;background:var(--ir-canvas);font-family:Pretendard,sans-serif}.ir-host-page{position:relative;width:1920px;height:1080px;margin:0;padding:0;background:var(--ir-canvas)}section.ir-slide{width:1920px;height:1080px;position:relative;margin:0}:where([data-image-slot-id]){position:relative;touch-action:none}:where([data-image-resize-handle]){position:absolute;right:4px;bottom:4px;width:20px;height:20px;border:1px solid rgba(23,61,49,.18);border-radius:4px;background:rgba(255,255,255,.92);box-shadow:0 1px 4px rgba(0,13,59,.12);cursor:nwse-resize;opacity:0;pointer-events:none;transition:opacity 120ms ease}:where([data-image-slot-id]):hover [data-image-resize-handle]{opacity:1;pointer-events:auto}${safeCss}</style></head><body><div class="ir-host-page">${root.outerHTML}</div>${bridge}</body></html>`;
}
