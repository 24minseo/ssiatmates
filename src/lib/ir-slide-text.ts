export type SlideTextEdit = {
  text?: string;
  size?: number;
  bold?: boolean;
  x?: number;
  y?: number;
};
export type TextSelection = {
  id: string;
  text: string;
  size: number;
  bold: boolean;
  x: number;
  y: number;
};

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
  for (const [index, el] of groups.entries()) {
    const id = "t" + index;
    el.setAttribute("data-ir-text", id);
    const edit = edits[id];
    if (!edit) continue;
    if (typeof edit.text === "string") {
      el.textContent = edit.text;
      el.style.whiteSpace = "pre-wrap";
    }
    if (edit.size !== undefined || edit.bold !== undefined) {
      for (const part of [el, ...el.querySelectorAll<HTMLElement>("*")]) {
        if (edit.size !== undefined)
          part.style.setProperty("font-size", edit.size + "px", "important");
        if (edit.bold !== undefined)
          part.style.setProperty("font-weight", edit.bold ? "700" : "400", "important");
      }
    }
    if (edit.x || edit.y) {
      if (el.matches(inline)) el.style.display = "inline-block";
      el.style.translate = (edit.x || 0) + "px " + (edit.y || 0) + "px";
    }
  }
}
