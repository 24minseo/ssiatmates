import { useEffect, useMemo, useRef, useState } from "react";
import type { HtmlSlide, HtmlView, ImageSlot } from "./html-api";

import { previewHtml } from "./html-preview";

export function HtmlSlidePreview({
  slide,
  view,
  urls,
  mediaOrigin,
  onSelect,
}: {
  slide: HtmlSlide;
  view: HtmlView;
  urls: Record<string, string>;
  mediaOrigin: string;
  onSelect?: ((slot: ImageSlot | null, point: { x: number; y: number }) => void) | undefined;
}) {
  const host = useRef<HTMLDivElement>(null),
    frame = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(0);
  const [identity] = useState(() => ({
    nonce: crypto.randomUUID().replaceAll("-", ""),
    channel: crypto.randomUUID(),
  }));
  const interactive = Boolean(onSelect);
  const html = useMemo(
    () =>
      previewHtml(slide, view, urls, identity.nonce, identity.channel, mediaOrigin, interactive),
    [slide, view, urls, identity, mediaOrigin, interactive],
  );
  useEffect(() => {
    const observer = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width || 0));
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!onSelect) return;
    function receive(e: MessageEvent) {
      if (
        e.source !== frame.current?.contentWindow ||
        e.origin !== "null" ||
        !e.data ||
        e.data.type !== "ir-image-select" ||
        e.data.channel !== identity.channel ||
        e.data.slideId !== slide.slideId ||
        !Number.isFinite(e.data.x) ||
        !Number.isFinite(e.data.y) ||
        e.data.x < 0 ||
        e.data.x > 1920 ||
        e.data.y < 0 ||
        e.data.y > 1080
      )
        return;
      const slot =
        view.imageSlots.find((s) => s.slideId === slide.slideId && s.id === e.data.slotId) || null;
      onSelect?.(slot, { x: e.data.x as number, y: e.data.y as number });
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [identity, onSelect, slide.slideId, view.imageSlots]);
  return (
    <div
      ref={host}
      className="relative aspect-video w-full overflow-hidden rounded-xl border border-field-border bg-surface"
    >
      <iframe
        ref={frame}
        title={`${slide.sectionLabel}: ${slide.headline}`}
        sandbox={interactive ? "allow-scripts" : ""}
        referrerPolicy="no-referrer"
        srcDoc={html}
        className="absolute left-0 top-0 border-0"
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${width / 1920})`,
          transformOrigin: "top left",
          pointerEvents: interactive ? "auto" : "none",
        }}
      />
    </div>
  );
}
