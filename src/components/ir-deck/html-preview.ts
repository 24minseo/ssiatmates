import type { HtmlSlide, HtmlView } from "./html-api";
import { prepareSlideText, prepareSlideGroups } from "@/lib/ir-slide-text";

const fontCss = `@font-face{font-family:Pretendard;font-style:normal;font-weight:100 900;font-display:swap;src:url(https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2) format('woff2')}@font-face{font-family:Paperlogy;font-style:normal;font-weight:400;font-display:swap;src:url(https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/Paperlogy-4Regular.woff2) format('woff2')}@font-face{font-family:Paperlogy;font-style:normal;font-weight:700;font-display:swap;src:url(https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/Paperlogy-7Bold.woff2) format('woff2')}`;

// HTML을 앱 DOM에 삽입하지 않는다. 서버 검사를 통과한 정적 문서만 opaque-origin iframe에서 표시한다.
export function previewHtml(
  slide: HtmlSlide,
  view: HtmlView,
  urls: Record<string, string>,
  nonce: string,
  channel: string,
  mediaOrigin: string,
  interactive: boolean,
  directText: boolean,
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
  prepareSlideGroups(root,slide.groupEdits);
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
        var textMode=false, editing=null, directText=${directText ? "true" : "false"};
        function editEvent(kind, value) {
          if(editing) parent.postMessage({type:'ir-inline-event',channel:${JSON.stringify(channel)},slideId:${JSON.stringify(slide.slideId)},id:editing.dataset.irText,kind,value},'*');
        }
        function publishRange() {
          var sel=getSelection();
          if (!editing || !sel.rangeCount || !editing.contains(sel.anchorNode) || !editing.contains(sel.focusNode)) return;
          var range=sel.getRangeAt(0), before=range.cloneRange();
          before.selectNodeContents(editing); before.setEnd(range.startContainer,range.startOffset);

          editEvent('range',[before.toString().length,before.toString().length+range.toString().length]);
        }
        document.addEventListener('selectionchange',publishRange);
        document.addEventListener('input',function(){if(editing){editEvent('input',editing.innerText);publishRange();}});
        window.addEventListener('message',function(e){
          var m=e.data;
          if(e.source!==parent || !m || m.channel!==${JSON.stringify(channel)}) return;
          if(m.type==='ir-group-restore' && lastMove && lastMove.node.dataset.irGroup===m.id){
            resetGroup(lastMove);lastMove=null;return;
          }
          if(m.type==='ir-text-mode') { textMode=m.enabled===true;allowGroups=m.moveGroups===true;if(textMode)selectGroup(null);return; }
          if(m.type==='ir-text-active') {
            if(editing && editing.dataset.irText!==m.id){editing.removeAttribute('contenteditable');editing=null;}
            return;
          }
          if(m.type!=='ir-inline-style' || !editing || editing.dataset.irText!==m.id) return;
          var value=m.value, key=m.key;
          if(key==='bold' || key==='color') {
            var bounds=m.bounds;
            if(!Array.isArray(bounds) || !bounds.every(Number.isFinite))return;
            var walker=document.createTreeWalker(editing,4), nodes=[], index=0;
            while(walker.nextNode()){
              var item=walker.currentNode;
              var from=Math.max(0,bounds[0]-index),to=Math.min(item.length,bounds[1]-index);
              if(to>from)nodes.push({item,from,to});
              index+=item.length;
            }
            for(var run of nodes){
              var node=run.item, from=run.from,to=run.to;
              if(to<=from)continue;
              if(to<node.length)node.splitText(to);
              var target=from?node.splitText(from):node, span=document.createElement('span');
              span.style.setProperty(key==='bold'?'font-weight':'color',key==='bold'?(value?'700':'400'):value,'important');
              target.replaceWith(span);span.append(target);
            }
            if(m.partial){
              var sel=getSelection(), range=document.createRange(), cursor=0;
              walker=document.createTreeWalker(editing,4);
              while(walker.nextNode()){
                var n=walker.currentNode, stop=cursor+n.length;
                if(cursor<=bounds[0] && bounds[0]<stop)range.setStart(n,bounds[0]-cursor);
                if(cursor<bounds[1] && bounds[1]<=stop){range.setEnd(n,bounds[1]-cursor);break;}
                cursor=stop;
              }
              sel.removeAllRanges();sel.addRange(range);
            }
            return;
          }
          if(key==='size')for(var part of [editing,...editing.querySelectorAll('*')])part.style.setProperty('font-size',value+'px','important');
          if(key==='align')editing.style.setProperty('text-align',value,'important');
          if(key==='position'){
            if(getComputedStyle(editing).display==='inline')editing.style.display='inline-block';
            editing.style.translate=value[0]+'px '+value[1]+'px';
          }
          if(key==='scaleBox'){
            if(getComputedStyle(editing).display==='inline')editing.style.display='inline-block';
            editing.style.setProperty('width',value[0]+'px','important');
            editing.style.setProperty('min-height',value[1]+'px','important');
            editing.style.setProperty('height','auto','important');
            editing.style.setProperty('overflow-wrap','anywhere','important');
            for(var part of [editing,...editing.querySelectorAll('*')]){
              part.style.setProperty('font-size',value[2]+'px','important');
              part.style.setProperty('line-height','normal','important');
            }
          }
          var rect=editing.getBoundingClientRect();
          editEvent('geometry',{left:rect.left,top:rect.top,width:rect.width,height:rect.height});
        });
        var groupDrag=null, selectedGroup=null, allowGroups=false, lastMove=null;
        var grip=document.createElement('button');
        grip.type='button';grip.setAttribute('aria-label','카드 크기 조절');
        grip.style.cssText='position:fixed;display:none;width:20px;height:20px;padding:0;background:white;border:2px solid #238767;cursor:nwse-resize;touch-action:none;z-index:2147483647';
        document.body.appendChild(grip);
        function placeGrip(){
          grip.style.display=selectedGroup?'block':'none';
          if(selectedGroup){var r=selectedGroup.getBoundingClientRect();grip.style.left=(r.right-20)+'px';grip.style.top=(r.bottom-20)+'px';}
        }
        function resetGroup(g){
          g.node.style.translate=g.original;
          g.node.style.scale=g.originalScale;
          g.node.style.transformOrigin=g.originalOrigin;
          placeGrip();
        }
        function selectGroup(el){
          if(selectedGroup) selectedGroup.removeAttribute('data-ir-selected-group');
          selectedGroup=el;
          if(el)el.setAttribute('data-ir-selected-group','');placeGrip();
        }
        function groupAt(target){
          var fallback=null, chart=null;
          for(var el=target;el && !el.matches('section.ir-slide');el=el.parentElement){
            if(!el.hasAttribute('data-ir-group'))continue;
            var name=(el.getAttribute('class') || '').toLowerCase().split(/[^a-z0-9]+/);
            if(el.matches('figure,article') || name.includes('card') || name.includes('panel'))return el;
            if(el.matches('table,svg') || name.some(k=>['chart','graph','plot','diagram'].includes(k)))chart=el;
            var r=el.getBoundingClientRect(), css=getComputedStyle(el);
            if(!fallback && r.width*r.height<1920*1080*.85 && (css.backgroundColor!=='rgba(0, 0, 0, 0)' || el.childElementCount>1))fallback=el;
          }
          return chart || fallback;
        }
        document.addEventListener('pointerdown',function(e){
          if(e.button !== 0) return;
          var target=e.target instanceof Element ? e.target : null;
          // Image selection must win even while text editing mode is active.
          // Otherwise the text-mode early return makes images appear unclickable
          // until the user manually exits text editing.
          if ((textMode || directText) && !(target && target.closest('[data-image-slot-id]'))) {
            var block=target && target.closest('[data-ir-text]');
            if(editing && editing!==block){
              // Finish the previous text edit, but let this same click select
              // the new text instead of forcing the user to click twice.
              editEvent('finish',null);
              editing=null;
            }
            if(block && !editing){
              editing=block;block.contentEditable='plaintext-only';
              var css=getComputedStyle(block), r=block.getBoundingClientRect();
              var originalWeights=[], walker=document.createTreeWalker(block,4), offset=0;
              while(walker.nextNode()){
                var n=walker.currentNode, end=offset+n.length, heavy=Number(getComputedStyle(n.parentElement).fontWeight)>=600;
                if(heavy!==(Number(css.fontWeight)>=600))originalWeights.push({start:offset,end:end,bold:heavy});
                offset=end;
              }
              parent.postMessage({type:'ir-text-select',channel:${JSON.stringify(channel)},slideId:${JSON.stringify(slide.slideId)},
                box:{left:r.left,top:r.top,width:r.width,height:r.height,font:css.fontFamily,color:css.color,lineHeight:css.lineHeight},
                id:block.dataset.irText,text:block.innerText,initialWeights:originalWeights,align:css.textAlign,size:parseFloat(getComputedStyle(target.closest('[data-ir-text]')===block?target:block).fontSize),bold:Number(css.fontWeight)>=600,dx:0,dy:0},'*');
            }
            return;
          }
          var resize=target && target.closest('[data-image-resize-handle]');
          var n=resize ? resize.closest('[data-image-slot-id]') : target && target.closest('[data-image-slot-id]');
          e.preventDefault();
          if(allowGroups && !n){
            var resizing=target===grip;
            var group=resizing?selectedGroup:target && groupAt(target);
            selectGroup(group);
            if(group){
              var offset=group.style.translate.split(' ');
              var rect=group.getBoundingClientRect();
              groupDrag={node:group,resizing:resizing,w:rect.width,h:rect.height,baseScale:number(group.style.scale,1),originalScale:group.style.scale,originalOrigin:group.style.transformOrigin,original:group.style.translate,fromX:number(offset[0],0),fromY:number(offset[1],0),sx:e.clientX,sy:e.clientY,pointer:e.pointerId};
              group.setPointerCapture(e.pointerId);
              return;
            }
          } else selectGroup(null);
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
          if(groupDrag && e.pointerId===groupDrag.pointer){
            var g=groupDrag;
            if(g.resizing){
              var dx=e.clientX-g.sx, dy=e.clientY-g.sy;
              g.scale=clamp(Math.round(g.baseScale*(1+(dx*g.w+dy*g.h)/Math.max(1,g.w*g.w+g.h*g.h))*1000)/1000,.1,8);
              g.node.style.transformOrigin='0 0';
              g.node.style.scale=String(g.scale);
              placeGrip();
              return;
            }
            g.x=clamp(Math.round(g.fromX+e.clientX-g.sx),-1920,1920);
            g.y=clamp(Math.round(g.fromY+e.clientY-g.sy),-1080,1080);
            g.node.style.translate=g.x+'px '+g.y+'px';placeGrip();
            return;
          }
          if(!active) return;
          e.preventDefault();
          updateDrag(e);
          send(active.mode === 'resize' ? 'ir-image-resize-move' : 'ir-image-drag-move',active.node,e);
        });
        document.addEventListener('pointerup',function(e){
          if(groupDrag && e.pointerId===groupDrag.pointer){
            var g=groupDrag;groupDrag=null;lastMove=g;
            if((g.scale!==undefined && g.scale!==g.baseScale) || (g.x!==undefined && (g.x!==g.fromX || g.y!==g.fromY)))parent.postMessage({type:'ir-group-move',channel:${JSON.stringify(channel)},slideId:${JSON.stringify(slide.slideId)},id:g.node.dataset.irGroup,x:g.x??g.fromX,y:g.y??g.fromY,scale:g.scale??g.baseScale},'*');
            return;
          }
          if(!active) return;
          e.preventDefault();
          updateDrag(e);
          send(active.mode === 'resize' ? 'ir-image-resize-end' : 'ir-image-drag-end',active.node,e);
          active=null;
        });
        document.addEventListener('pointercancel',function(){ active=null;if(groupDrag)resetGroup(groupDrag);groupDrag=null; });
        document.addEventListener('keydown',function(e){
          if(editing) return;
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
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${fontCss}:root{${vars}}*{box-sizing:border-box}html,body{margin:0;padding:0;width:1920px;height:1080px;overflow:hidden;background:var(--ir-canvas);font-family:Pretendard,sans-serif}.ir-host-page{position:relative;width:1920px;height:1080px;margin:0;padding:0;background:var(--ir-canvas)}section.ir-slide{width:1920px;height:1080px;position:relative;margin:0}:where([data-image-slot-id]){position:relative;touch-action:none}:where([data-image-resize-handle]){position:absolute;right:4px;bottom:4px;width:20px;height:20px;border:1px solid rgba(23,61,49,.18);border-radius:4px;background:rgba(255,255,255,.92);box-shadow:0 1px 4px rgba(0,13,59,.12);cursor:nwse-resize;opacity:0;pointer-events:none;transition:opacity 120ms ease}:where([data-image-slot-id]):hover [data-image-resize-handle]{opacity:1;pointer-events:auto}${safeCss}[data-ir-selected-group]{outline:2px solid #238767!important}[data-ir-text][contenteditable]{outline:none;user-select:text;-webkit-user-select:text;cursor:text}</style></head><body><div class="ir-host-page">${root.outerHTML}</div>${bridge}</body></html>`;
}
