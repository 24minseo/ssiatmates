import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlignLeft, AlignCenter, AlignRight, Trash2 } from "lucide-react";
import type { SlideTextEdit, TextSelection } from "@/lib/ir-slide-text";

export function SlideTextEditor({
  stage, font, selection, inactive=false,
  stored,
  palette,
  save,
  close,
}: {
  stage: HTMLDivElement | null;
  font: string;
  inactive?: boolean;
  selection: TextSelection;
  stored: SlideTextEdit;
  palette: (string | null | undefined)[];
  save: (edit: SlideTextEdit) => Promise<void>;
  close: () => void;
}) {
  const toolbar = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(selection);
  const input = useRef<HTMLTextAreaElement>(null);
  const [colors, setColors] = useState(stored.colors ?? []);
  const [custom, setCustom] = useState("#1f8064");
  function paint(color: string) {
    const field = input.current;
    if (!field || !draft.text.length) return;
    const partial = field.selectionStart !== field.selectionEnd;
    const start = partial ? field.selectionStart : 0;
    const end = partial ? field.selectionEnd : draft.text.length;
    const remaining = colors.flatMap(r => {
      if (r.end <= start || r.start >= end) return [r];
      return [...(r.start < start ? [{ ...r, end: start }] : []),
        ...(r.end > end ? [{ ...r, start: end }] : [])];
    });
    setColors([...remaining, { start, end, color }].sort((a,b) => a.start-b.start));
  }
  function changeText(text: string) {
    const previous = draft.text;
    let left = 0, tail = 0;
    while (left < Math.min(previous.length,text.length) && previous[left] === text[left]) left++;
    while (tail < Math.min(previous.length,text.length)-left &&
      previous[previous.length-1-tail] === text[text.length-1-tail]) tail++;
    const delta = text.length - previous.length;
    setColors(colors.flatMap(r => {
      const pieces = [];
      if (r.start < left) pieces.push({ ...r, end: Math.min(left,r.end) });
      if (r.start < previous.length-tail && r.end > left && r.start <= left &&
          r.end >= previous.length-tail && text.length-tail > left)
        pieces.push({ ...r, start:left, end:text.length-tail });
      if (r.end > previous.length-tail) pieces.push({ ...r, start:Math.max(r.start,previous.length-tail)+delta, end:r.end+delta });
      return pieces;
    }));
    setDraft({ ...draft, text });
  }
  const [showPalette,setShowPalette] = useState(false);
  const [error,setError] = useState("");
  const saving = useRef(false);
  const box = selection.box ?? {left:64,top:64,width:720,height:64,font,color:"var(--ir-ink)",lineHeight:"1.25"};
  const [dimensions,resize] = useState({width:box.width,height:box.height});
  const [scale,setScale] = useState((stage?.clientWidth || 1920)/1920);
  const drag = useRef<{x:number;y:number;w:number;h:number;dx:number;dy:number;move:boolean}|null>(null);
  useEffect(() => {
    input.current?.focus();
    if (!stage) return;
    const observer=new ResizeObserver(() => setScale(stage.clientWidth/1920));
    observer.observe(stage);
    return () => observer.disconnect();
  },[stage]);
  async function finish(remove=false) {
    if (saving.current) return;
    const edit:SlideTextEdit={...stored};
    if (draft.text !== selection.text) edit.text=draft.text;
    if (colors !== stored.colors && (colors.length || stored.colors?.length)) {
      edit.text=draft.text;
      edit.colors=colors;
    }
    if (draft.align && draft.align !== selection.align) edit.align=draft.align;
    if (draft.size !== selection.size) edit.size=draft.size;
    if (draft.bold !== selection.bold) edit.bold=draft.bold;
    if (draft.x !== (stored.x ?? 0)) edit.x=draft.x;
    if (draft.y !== (stored.y ?? 0)) edit.y=draft.y;
    if (dimensions.width !== box.width) edit.width=dimensions.width;
    if (dimensions.height !== box.height) edit.height=dimensions.height;
    if (selection.isNew && !draft.text.trim()) { close();return true; }
    if (!remove && JSON.stringify(edit)===JSON.stringify(stored)) {close();return true;}
    saving.current=true;
    try { await save(remove || !draft.text.trim() ? {deleted:true} : edit); close(); return true; }
    catch (err) {setError(err instanceof Error ? err.message : "저장에 실패했어요. 다시 시도해 주세요.");}
    finally {saving.current=false;}
  }
  useEffect(() => {
    if (inactive) return;
    function outside(e:MouseEvent) {
      if (!(e.target instanceof Element) || toolbar.current?.contains(e.target) || canvas.current?.contains(e.target)) return;
      const target=e.target.closest<HTMLElement>("button,a,input,select");
      if (target) {
        e.preventDefault();
        e.stopImmediatePropagation();
        void finish().then(ok=>{if(ok) requestAnimationFrame(()=>target.isConnected && target.click());});
      } else void finish();
    }
    document.addEventListener("click",outside,true);
    return ()=>document.removeEventListener("click",outside,true);
  });
  const layout={width:"100%",height:"100%",margin:0,padding:0,border:0,boxSizing:"border-box" as const,
    fontFamily:box.font,fontSize:draft.size,fontWeight:draft.bold?700:400,lineHeight:box.lineHeight.endsWith("px")?parseFloat(box.lineHeight)/selection.size:box.lineHeight,
    textAlign:draft.align,whiteSpace:"pre-wrap" as const,overflowWrap:"anywhere" as const};
  const wordView = <>{colors.map((r,i)=><span key={r.start}>{draft.text.slice(colors[i-1]?.end ?? 0,r.start)}<span style={{color:r.color}}>{draft.text.slice(r.start,r.end)}</span></span>)}{draft.text.slice(colors.at(-1)?.end ?? 0)}</>;
  return <fieldset disabled={inactive} ref={toolbar as React.RefObject<HTMLFieldSetElement>} role="toolbar" aria-label="선택한 텍스트 서식" className="flex flex-wrap items-center gap-2 px-2">
    <div className="relative">
      <button type="button" title="글자 색상" aria-label="글자 색상" aria-expanded={showPalette}
        className="block size-6 rounded-full border" style={{background:"conic-gradient(red,yellow,lime,cyan,blue,magenta,red)"}}
        onClick={()=>setShowPalette(!showPalette)} />
      {showPalette && <div className="absolute left-0 top-full z-50 mt-2 grid w-40 grid-cols-5 gap-1 rounded-lg border bg-white p-2 shadow">
        {Array.from(new Set(palette.filter((c):c is string=>!!c && /^#[0-9a-f]{6}$/i.test(c)))).map(c=>
          <button key={c} aria-label={c} className="size-6 rounded-full border" style={{background:c}} onClick={()=>{paint(c);setShowPalette(false);}} />)}
        <label className="col-span-5 text-xs">직접 선택 <input type="color" value={custom} onChange={e=>{setCustom(e.target.value);paint(e.target.value);}} /></label>
      </div>}
    </div>
    <button type="button" aria-label="굵게" aria-pressed={draft.bold} className="rounded px-2 font-bold aria-pressed:bg-item-hover" onClick={()=>setDraft({...draft,bold:!draft.bold})}>B</button>
    {(["size","x","y"] as const).map((k,i)=><label key={k+draft[k]} className="flex items-center gap-1 text-xs">{["크기","가로","세로"][i]}
      <input type="number" aria-label={["글자 크기","가로 이동","세로 이동"][i]} className="w-14 rounded border px-1 py-1" defaultValue={draft[k]}
        onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}} onBlur={e=>{
          const v=e.target.valueAsNumber;
          if(Number.isFinite(v))setDraft({...draft,[k]:Math.max(k==="size"?1:-1920,Math.min(k==="size"?512:1920,v))});
        }} /></label>)}
    {([AlignLeft,AlignCenter,AlignRight]).map((Icon,i)=>{
      const align=(["left","center","right"] as const)[i]!;
      return <button key={align} aria-label={["왼쪽 정렬","가운데 정렬","오른쪽 정렬"][i]} aria-pressed={draft.align===align}
        className="rounded p-1 aria-pressed:bg-item-hover" onClick={()=>setDraft({...draft,align})}><Icon size={17}/></button>;
    })}
    <button aria-label="텍스트 삭제" title="텍스트 삭제" onClick={()=>void finish(true)}><Trash2 size={17}/></button>
    {error && <button role="alert" onClick={()=>void finish()}>{error} · 다시 저장</button>}
    {stage && createPortal(<div className="absolute inset-0 z-20 overflow-hidden" onClick={e=>{if(e.target===e.currentTarget)void finish();}}>
      <div style={{width:1920,height:1080,transformOrigin:"top left",transform:"scale("+scale+")",pointerEvents:"none"}}>
        <div ref={canvas} style={{position:"absolute",pointerEvents:"auto",left:box.left+draft.x-(stored.x??0),top:box.top+draft.y-(stored.y??0),...dimensions,outline:"2px solid #238767"}}>
          <div aria-hidden style={{...layout,color:box.color,pointerEvents:"none",overflow:"hidden"}}>{wordView}</div>
          <textarea ref={input} aria-label="슬라이드 텍스트" spellCheck={false} maxLength={6000}
            style={{...layout,position:"absolute",inset:0,background:"transparent",color:"transparent",caretColor:box.color,resize:"none",outline:0}}
            value={draft.text} onChange={e=>changeText(e.target.value)} onScroll={e=>{const mirror=e.currentTarget.previousElementSibling;if(mirror)mirror.scrollTop=e.currentTarget.scrollTop;}} />
          {["move","resize"].map(mode=><button key={mode} aria-label={mode==="move"?"텍스트 상자 이동":"텍스트 상자 크기 조절"}
            style={{position:"absolute",touchAction:"none",right:0,...(mode==="move"?{top:-5,left:0,height:8,cursor:"move"}:{bottom:0,width:18,height:18,border:"2px solid #238767",background:"white",cursor:"nwse-resize"})}}
            onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,w:dimensions.width,h:dimensions.height,dx:draft.x,dy:draft.y,move:mode==="move"};}}
            onPointerMove={e=>{const g=drag.current;if(!g)return;const dx=Math.round((e.clientX-g.x)/scale),dy=Math.round((e.clientY-g.y)/scale);
              if(g.move)setDraft({...draft,x:Math.max(-1920,Math.min(1920,g.dx+dx)),y:Math.max(-1920,Math.min(1920,g.dy+dy))});
              else resize({width:Math.min(1920,Math.max(12,Math.round(g.w+dx))),height:Math.min(1080,Math.max(12,Math.round(g.h+dy)))});}}
            onLostPointerCapture={()=>{drag.current=null;}} />)}
        </div>
      </div>
    </div>,stage)}
  </fieldset>;
}
