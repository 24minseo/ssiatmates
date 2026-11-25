/** Runs inside Chromium, after image composition and text edits. */
export function takeSlideText(pageRoot: Element) {
  const page = pageRoot.getBoundingClientRect();
  const boxes = [];
  for (const block of pageRoot.querySelectorAll<HTMLElement>("[data-ir-text]")) {
    const style = getComputedStyle(block);
    if (
      !block.innerText.trim() ||
      style.visibility !== "visible" ||
      !block.checkVisibility({ opacityProperty: true })
    )
      continue;
    const range = document.createRange();
    range.selectNodeContents(block);
    const bounds = range.getBoundingClientRect();
    if (
      !bounds.width ||
      !bounds.height ||
      bounds.right <= page.left ||
      bounds.bottom <= page.top ||
      bounds.left >= page.right ||
      bounds.top >= page.bottom
    )
      continue;

    type Run = {
      text: string;
      options: {
        fontFace: string;
        fontSize: number;
        color: string;
        bold: boolean;
        italic: boolean;
        breakLine?: boolean;
      };
    };
    const runs: Run[] = [];
    let lastLineTop: number | undefined;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const parent = node.parentElement!;
      const css = getComputedStyle(parent);
      if (css.visibility !== "visible" || css.display === "none") continue;
      const channels = css.color.match(/[\d.]+/g)?.slice(0, 3) ?? ["0", "0", "0"];
      const options = {
        color: channels.map((c) => Math.round(Number(c)).toString(16).padStart(2, "0")).join(""),
        fontFace: css.fontFamily.split(",")[0]!.trim().replace(/["']/g, ""),
        fontSize: parseFloat(css.fontSize) / 2,
        bold: Number(css.fontWeight) >= 600,
        italic: css.fontStyle === "italic",
      };
      // Keep Chromium's wrapping without turning each line into a separate shape.
      for (let start = 0; start < node.length;) {
        range.setStart(node, start);
        let lo = start + 1,
          hi = node.length;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          range.setEnd(node, mid);
          if (range.getClientRects().length <= 1) lo = mid;
          else hi = mid - 1;
        }
        range.setEnd(node, lo);
        const rect = range.getBoundingClientRect();
        if (rect.height && rect.width) {
          if (
            lastLineTop !== undefined &&
            rect.top - lastLineTop > parseFloat(css.fontSize) * 0.55 &&
            runs.length
          )
            runs[runs.length - 1]!.options.breakLine = true;
          let text = node.data.slice(start, lo);
          if (!css.whiteSpace.startsWith("pre")) text = text.replace(/\s+/g, " ");
          runs.push({ text, options: { ...options } });
          lastLineTop = rect.top;
        }
        start = lo;
      }
    }
    if (!runs.length) continue;
    boxes.push({
      runs,
      x: (bounds.x - page.x) / 144,
      y: (bounds.y - page.y) / 144,
      w: bounds.width / 144,
      h: bounds.height / 144,
      lineHeight: parseFloat(style.lineHeight) / 2,
      align:
        style.textAlign === "center"
          ? ("center" as const)
          : ["right", "end"].includes(style.textAlign)
            ? ("right" as const)
            : ("left" as const),
    });
    // First measure the whole group, then hide only glyphs. Borders, fills and
    // children carrying decoration still paint into the background screenshot.
    for (const el of [block, ...block.querySelectorAll<HTMLElement>("*")]) {
      if (getComputedStyle(el).backgroundClip === "text")
        el.style.setProperty("background", "none", "important");
      el.style.setProperty("-webkit-text-fill-color", "transparent", "important");
      el.style.setProperty("text-shadow", "none", "important");
      el.style.setProperty("text-decoration-color", "transparent", "important");
      el.style.setProperty("-webkit-text-stroke-width", "0", "important");
    }
  }
  return boxes;
}
