export type WeightRange = {start:number;end:number;bold:boolean};
export type ColorRange = { start: number; end: number; color: string };
export type TextAlign = "left" | "center" | "right";
export type SlideTextEdit = {
  align?: TextAlign;
  deleted?: boolean;
  width?: number;
  height?: number;
  designFont?: "Paperlogy" | "Pretendard";
  text?: string;
  weights?: WeightRange[];
  colors?: ColorRange[];
  size?: number;
  bold?: boolean;
  x?: number;
  y?: number;
};
export type TextSelection = {
  align?: TextAlign;
  initialWeights?: WeightRange[];
  isNew?: boolean;
  box?: {left:number; top:number; width:number; height:number; font:string; color:string; lineHeight:string};
  id: string;
  text: string;
  size: number;
  bold: boolean;
  x: number;
  y: number;
};

export type GroupOffsets = Record<string,{x:number;y:number;scale?:number}>;

// Use the unmodified slide tree so editor and export assign the same IDs.
export function prepareSlideGroups(root:Element, offsets:GroupOffsets = {}) {
  root.querySelectorAll<HTMLElement>("div,article,aside,figure,table,section,svg").forEach((el,index)=>{
    if(el.closest("[data-image-slot-id]")) return;
    const id="g"+index;
    el.setAttribute("data-ir-group",id);
    const shift=offsets[id];
    if(shift?.scale && shift.scale!==1){
      el.style.transformOrigin="0 0";
      el.style.scale=String(shift.scale);
      el.dataset.irGroupScale=String(shift.scale);
    }
    if(shift && Number.isFinite(shift.x) && Number.isFinite(shift.y))
      el.style.translate=shift.x+"px "+shift.y+"px";
  });
}

// Also evaluated directly in Chromium. Keep this function self-contained.
export function prepareSlideText(root: Element, edits: Record<string, SlideTextEdit> = {}) {
  const inline = "span,strong,b,em,i,u,s,small,mark,sub,sup,br";
  const groups: HTMLElement[] = [];
  function visit(parent: Element) {
    for (const child of Array.from(parent.children)) {
      if (
        child.namespaceURI !== "http://www.w3.org/1999/xhtml" ||
        child.matches("script,style,template,[data-image-slot-id],[data-slot-placeholder-ui]")
      )
        continue;
      const element = child as HTMLElement;
      if (!element.textContent?.trim()) continue;
      if (Array.from(element.querySelectorAll("*")).every((el) =>
        el.matches(inline) && !el.matches("[data-image-slot-id],[data-slot-placeholder-ui]"))) {
        groups.push(element);
      } else {
        visit(element);
      }
    }
    // Some layouts put body copy directly beside a badge or a block element.
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType !== 3 || !node.textContent?.trim()) continue;
      const span = parent.ownerDocument.createElement("span");
      node.replaceWith(span);
      span.append(node);
      groups.push(span);
    }
  }
  visit(root);
  const blocks = groups.map((el,index) => ({ id: "t" + index, el }));
  for (const [id, edit] of Object.entries(edits)) {
    if (!/^u[0-9a-f]{32}$/.test(id) || edit.deleted || !edit.text) continue;
    const el = root.ownerDocument.createElement("div");
    el.style.cssText = "position:absolute;left:64px;top:64px;width:720px;z-index:20;white-space:pre-wrap;overflow-wrap:anywhere;font-size:40px;color:var(--ir-ink)";
    el.style.fontFamily = edit.designFont === "Paperlogy" ? "Paperlogy, sans-serif" : "Pretendard, sans-serif";
    root.append(el);
    blocks.push({id,el});
  }
  for (const {id, el} of blocks) {
    el.setAttribute("data-ir-text", id);
    const edit = edits[id];
    if (!edit) continue;
    if (edit.deleted) { el.remove(); continue; }
    if (edit.width || edit.height) {
      if (el.matches(inline)) el.style.display = "inline-block";
      if (edit.width) el.style.setProperty("width", edit.width+"px","important");
      if (edit.height) {
        el.style.setProperty("min-height",edit.height+"px","important");
        el.style.setProperty("height","auto","important");
      }
      el.style.setProperty("overflow-wrap","anywhere","important");
    }
    if (edit.align) {
      if (el.matches(inline)) {
        el.style.display = "inline-block";
        el.style.width = "100%";
      }
      el.style.setProperty("text-align",edit.align,"important");
    }
    if (typeof edit.text === "string" && el.textContent !== edit.text) {
      el.textContent = edit.text;
      el.style.whiteSpace = "pre-wrap";
    }
    if (edit.size !== undefined || edit.bold !== undefined) {
      for (const part of [el, ...el.querySelectorAll<HTMLElement>("*")]) {
        if (edit.size !== undefined)
          part.style.setProperty("font-size", edit.size + "px", "important");
        if (edit.size !== undefined && edit.width && edit.height) part.style.setProperty("line-height","normal","important");
        if (edit.bold !== undefined)
          part.style.setProperty("font-weight", edit.bold ? "700" : "400", "important");
      }
    }
    for (const ranges of [edit.colors,edit.weights]) {
      if (!ranges?.length) continue;
      const walker = el.ownerDocument.createTreeWalker(el, 4);
      const nodes: Text[] = [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      let offset = 0;
      for (const node of nodes) {
        const value = node.data;
        let cursor = 0;
        const fragment = el.ownerDocument.createDocumentFragment();
        for (const range of ranges) {
          const start = Math.max(cursor, range.start - offset, 0);
          const end = Math.min(value.length, range.end - offset);
          if (end <= start) continue;
          fragment.append(value.slice(cursor, start));
          const span = el.ownerDocument.createElement("span");
          if ("color" in range) span.style.setProperty("color",range.color,"important");
          else span.style.setProperty("font-weight",range.bold?"700":"400","important");
          span.textContent = value.slice(start, end);
          fragment.append(span);
          cursor = end;
        }
        if (cursor) {
          fragment.append(value.slice(cursor));
          node.replaceWith(fragment);
        }
        offset += value.length;
      }
    }
    if (edit.x || edit.y) {
      if (el.matches(inline)) el.style.display = "inline-block";
      el.style.translate = (edit.x || 0) + "px " + (edit.y || 0) + "px";
    }
  }
}
