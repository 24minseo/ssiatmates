import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { HtmlSlide, HtmlView, ImageSlot } from "./html-api";
import { cn } from "@/lib/utils";

import { previewHtml } from "./html-preview";

export function HtmlSlidePreview({
  slide,
  view,
  urls,
  mediaOrigin,
  onSelect,
  onDrag,
  onSlideShortcut,
  onSlideWheel,
  style,
  className,
}: {
  slide: HtmlSlide;
  view: HtmlView;
  urls: Record<string, string>;
  mediaOrigin: string;
  onSelect?: ((slot: ImageSlot | null, point: { x: number; y: number }) => void) | undefined;
  onDrag?:
    | ((
        phase: "start" | "move" | "end",
        mode: "move" | "resize",
        slot: ImageSlot | null,
        point: { x: number; y: number },
      ) => void)
    | undefined;
  onSlideShortcut?: ((key: "ArrowLeft" | "ArrowRight") => void) | undefined;
  onSlideWheel?: ((deltaY: number, deltaX: number) => void) | undefined;
  style?: CSSProperties;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null),
    frame = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(0);
  const [identity] = useState(() => ({
    nonce: crypto.randomUUID().replaceAll("-", ""),
    channel: crypto.randomUUID(),
  }));
  const viewRef = useRef(view);
  const urlsRef = useRef(urls);
  viewRef.current = view;
  urlsRef.current = urls;
  const interactive = Boolean(onSelect || onDrag || onSlideShortcut || onSlideWheel);
  const slideRenderKey = useMemo(
    () =>
      JSON.stringify({
        colors: view.document.designTokens.colors,
        slots: view.imageSlots.filter((slot) => slot.slideId === slide.slideId),
        urls: Object.fromEntries(
          view.imageSlots
            .filter((slot) => slot.slideId === slide.slideId && slot.assetId)
            .map((slot) => [slot.assetId, urls[slot.assetId!]]),
        ),
      }),
    [slide.slideId, urls, view.document.designTokens.colors, view.imageSlots],
  );
  const html = useMemo(
    () =>
      previewHtml(
        slide,
        viewRef.current,
        urlsRef.current,
        identity.nonce,
        identity.channel,
        mediaOrigin,
        interactive,
      ),
    [slide, slideRenderKey, identity, mediaOrigin, interactive],
  );
  useEffect(() => {
    const observer = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width || 0));
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!onSelect && !onDrag && !onSlideShortcut && !onSlideWheel) return;
    function receive(e: MessageEvent) {
      if (
        e.source !== frame.current?.contentWindow ||
        e.origin !== "null" ||
        !e.data ||
        ![
          "ir-image-select",
          "ir-image-drag-start",
          "ir-image-drag-move",
          "ir-image-drag-end",
          "ir-image-resize-start",
          "ir-image-resize-move",
          "ir-image-resize-end",
          "ir-slide-shortcut",
          "ir-slide-wheel",
        ].includes(e.data.type) ||
        e.data.channel !== identity.channel ||
        e.data.slideId !== slide.slideId
      )
        return;
      if (e.data.type === "ir-slide-wheel") {
        if (Number.isFinite(e.data.deltaY) && Number.isFinite(e.data.deltaX))
          onSlideWheel?.(e.data.deltaY as number, e.data.deltaX as number);
        return;
      }
      if (
        e.data.type === "ir-slide-shortcut" &&
        (e.data.key === "ArrowLeft" || e.data.key === "ArrowRight")
      ) {
        onSlideShortcut?.(e.data.key);
        return;
      }
      if (
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
      const point = { x: e.data.x as number, y: e.data.y as number };
      if (e.data.type === "ir-image-select") onSelect?.(slot, point);
      else
        onDrag?.(
          e.data.type.endsWith("-start")
            ? "start"
            : e.data.type.endsWith("-end")
              ? "end"
              : "move",
          e.data.type.startsWith("ir-image-resize") ? "resize" : "move",
          slot,
          point,
        );
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [identity, onDrag, onSelect, onSlideShortcut, onSlideWheel, slide.slideId, view.imageSlots]);
  return (
    <div
      ref={host}
      style={style}
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-xl border border-field-border bg-surface",
        className,
      )}
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
