import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import type { WeightRange, SlideTextEdit, TextSelection } from "@/lib/ir-slide-text";

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
  const [weights,setWeights]=useState<WeightRange[]>(stored.weights ?? selection.initialWeights ?? []);
  const [selected,setSelected]=useState<[number,number]>([0,0]);
  const [weightChanged,setWeightChanged]=useState(false);
  function command(key:string,value:unknown) {
    stage?.dispatchEvent(new CustomEvent("ir-inline-style",{detail:{id:selection.id,key,value,bounds:limits(),partial:selected[0]!==selected[1]}}));
  }
  function limits():[number,number] {
    const field=input.current;
    const [a,b]=field?[field.selectionStart,field.selectionEnd]:selected;
    return a===b?[0,draft.text.length]:[a,b];
  }
  function allBold(start:number,end:number) {
    let cursor=start;
    for(const r of weights){
      if(r.end<=start || r.start>=end)continue;
      if(!r.bold || (r.start>cursor && !draft.bold))return false;
      cursor=Math.max(cursor,r.end);
    }
    return draft.bold || (end>start && cursor>=end);
  }
  const [start,end]=limits();
  const pressed=allBold(start,end);
  function toggleBold() {
    const value=!pressed;
    if(start===0 && end===draft.text.length){
      setWeights([]);setDraft({...draft,bold:value});
    } else {
      const remaining=weights.flatMap(r=>r.end<=start || r.start>=end?[r]:[
        ...(r.start<start?[{...r,end:start}]:[]),...(r.end>end?[{...r,start:end}]:[])]);
      setWeights([...remaining,{start,end,bold:value}].sort((a,b)=>a.start-b.start));
    }
    setWeightChanged(true);
    command("bold",value);
  }
  function paint(color: string) {
    const [start,end]=limits();
    command("color",color);
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
    function rebase<T extends {start:number;end:number}>(ranges:T[]) {return ranges.flatMap(r => {
      const pieces = [];
      if (r.start < left) pieces.push({ ...r, end: Math.min(left,r.end) });
      if (r.start < previous.length-tail && r.end > left && r.start <= left &&
          r.end >= previous.length-tail && text.length-tail > left)
        pieces.push({ ...r, start:left, end:text.length-tail });
      if (r.end > previous.length-tail) pieces.push({ ...r, start:Math.max(r.start,previous.length-tail)+delta, end:r.end+delta });
      return pieces;
    });}
    setColors(rebase(colors));
    setWeights(rebase(weights));
    setDraft({ ...draft, text });
  }
  const [showPalette,setShowPalette] = useState(false);
  const [error,setError] = useState("");
  const saving = useRef(false);
  const box = selection.box ?? {left:64,top:64,width:720,height:64,font,color:"var(--ir-ink)",lineHeight:"1.25"};
  const [measured,setMeasured]=useState<{left:number;top:number;width:number;height:number}|null>(null);
  const [dimensions,resize] = useState({width:box.width,height:box.height});
  const [scale,setScale] = useState((stage?.clientWidth || 1920)/1920);
  const drag = useRef<{x:number;y:number;w:number;h:number;dx:number;dy:number;fontSize:number;move:boolean}|null>(null);
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
    if (weightChanged || (weights.length && draft.text !== selection.text)) {
      edit.bold=draft.bold;
      if(weights.length || stored.weights?.length)edit.weights=weights;
      if(weights.length)edit.text=draft.text;
    }
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
  useEffect(()=>{
    if (!stage || inactive || selection.isNew) return;
    function receive(event:Event) {
      const {id,kind,value}=(event as CustomEvent).detail;
      if(id!==selection.id)return;
      if(kind==="geometry")setMeasured(value);
      if(kind==="finish")void finish();
      if(kind==="range" && Array.isArray(value))setSelected([value[0],value[1]]);
      if(kind==="input" && typeof value==="string")changeText(value);
    }
    stage.addEventListener("ir-inline-event",receive);
    return ()=>stage.removeEventListener("ir-inline-event",receive);
  });
  const layout={width:"100%",height:"100%",margin:0,padding:0,border:0,boxSizing:"border-box" as const,
    fontFamily:box.font,fontSize:draft.size,fontWeight:draft.bold?700:400,lineHeight:box.lineHeight.endsWith("px")?parseFloat(box.lineHeight)/selection.size:box.lineHeight,
    textAlign:draft.align,whiteSpace:"pre-wrap" as const,overflowWrap:"anywhere" as const};
  const boundaries=Array.from(new Set([0,draft.text.length,...colors.flatMap(r=>[r.start,r.end]),...weights.flatMap(r=>[r.start,r.end])])).sort((a,b)=>a-b);
  const wordView=boundaries.slice(0,-1).map((at,i)=>{
    const weight=weights.find(r=>r.start<=at && r.end>at);
    return <span key={at} style={{color:colors.find(r=>r.start<=at && r.end>at)?.color,fontWeight:weight?(weight.bold?700:400):undefined}}>{draft.text.slice(at,boundaries[i+1])}</span>;
  });
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
    <button type="button" aria-label="굵게" aria-pressed={pressed} className="rounded px-2 font-bold aria-pressed:bg-item-hover" onMouseDown={e=>e.preventDefault()} onClick={toggleBold}>B</button>
    {(["size","x","y"] as const).map((k,i)=><label key={k+draft[k]} className="flex items-center gap-1 text-xs">{["크기","가로","세로"][i]}
      <input type="number" aria-label={["글자 크기","가로 이동","세로 이동"][i]} className="w-14 rounded border px-1 py-1" defaultValue={draft[k]}
        onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}} onBlur={e=>{
          const v=e.target.valueAsNumber;
          if(Number.isFinite(v)){const n=Math.max(k==="size"?1:-1920,Math.min(k==="size"?512:1920,v));setDraft({...draft,[k]:n});command(k==="size"?"size":"position",k==="size"?n:k==="x"?[n,draft.y]:[draft.x,n]);}
        }} /></label>)}
    {([AlignLeft,AlignCenter,AlignRight]).map((Icon,i)=>{
      const align=(["left","center","right"] as const)[i]!;
      return <button key={align} aria-label={["왼쪽 정렬","가운데 정렬","오른쪽 정렬"][i]} aria-pressed={draft.align===align}
        className="rounded p-1 aria-pressed:bg-item-hover" onClick={()=>{setDraft({...draft,align});command("align",align);}}><Icon size={17}/></button>;
    })}
    <button aria-label="텍스트 삭제" title="텍스트 삭제" onClick={()=>void finish(true)}><span
      aria-hidden="true"
      className="block size-[18px] bg-current"
      style={{
        maskImage: "url('/assets/sidebar/delete.svg')",
        WebkitMaskImage: "url('/assets/sidebar/delete.svg')",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    /></button>
    {error && <button role="alert" onClick={()=>void finish()}>{error} · 다시 저장</button>}
    {stage && createPortal(<div className="absolute inset-0 z-20 overflow-hidden" style={{pointerEvents:selection.isNew?"auto":"none"}} onClick={e=>{if(e.target===e.currentTarget)void finish();}}>
      <div style={{width:1920,height:1080,transformOrigin:"top left",transform:"scale("+scale+")",pointerEvents:"none"}}>
        <div ref={canvas} style={{position:"absolute",pointerEvents:selection.isNew?"auto":"none",left:box.left+draft.x-(stored.x??0),top:box.top+draft.y-(stored.y??0),...dimensions,...(!selection.isNew && measured ? measured : {}),outline:"2px solid #238767"}}>
          {selection.isNew && <><div aria-hidden style={{...layout,color:box.color,pointerEvents:"none",overflow:"hidden"}}>{wordView}</div>
          <textarea ref={input} aria-label="슬라이드 텍스트" spellCheck={false} maxLength={6000}
            style={{...layout,position:"absolute",inset:0,background:"transparent",color:"transparent",caretColor:box.color,resize:"none",outline:0}}
            value={draft.text} onSelect={e=>setSelected([e.currentTarget.selectionStart,e.currentTarget.selectionEnd])} onChange={e=>changeText(e.target.value)} onScroll={e=>{const mirror=e.currentTarget.previousElementSibling;if(mirror)mirror.scrollTop=e.currentTarget.scrollTop;}} /></>}
          {["move","resize"].map(mode=><button key={mode} aria-label={mode==="move"?"텍스트 상자 이동":"텍스트 상자 크기 조절"}
            style={{position:"absolute",pointerEvents:"auto",touchAction:"none",right:0,...(mode==="move"?{top:-5,left:0,height:8,cursor:"move"}:{bottom:0,width:18,height:18,border:"2px solid #238767",background:"white",cursor:"nwse-resize"})}}
            onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,w:dimensions.width,h:dimensions.height,dx:draft.x,dy:draft.y,fontSize:draft.size,move:mode==="move"};}}
            onPointerMove={e=>{const g=drag.current;if(!g)return;const dx=Math.round((e.clientX-g.x)/scale),dy=Math.round((e.clientY-g.y)/scale);
              if(g.move){const x=Math.max(-1920,Math.min(1920,g.dx+dx)),y=Math.max(-1920,Math.min(1920,g.dy+dy));setDraft({...draft,x,y});command("position",[x,y]);}
              else {
                const w=Math.max(1,g.w),h=Math.max(1,g.h);
                const factor=Math.max(Math.max(12/w,12/h,1/g.fontSize),Math.min(
                  1920/w,1080/h,512/g.fontSize,1+(dx*w+dy*h)/(w*w+h*h)));
                const width=Math.round(w*factor),height=Math.round(h*factor);
                const size=Math.round(g.fontSize*factor*100)/100;
                resize({width,height});
                setDraft(previous=>({...previous,size}));
                command("scaleBox",[width,height,size]);
              }}}


            onLostPointerCapture={()=>{drag.current=null;}} />)}
        </div>
      </div>
    </div>,stage)}
  </fieldset>;
}
