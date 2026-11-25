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
  onText,
  style,
  className,
}: {
  slide: HtmlSlide;
  onText?: ((s: import("@/lib/ir-slide-text").TextSelection) => void) | undefined;
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
  const editText = !!onText;
  const interactive = Boolean(onSelect || onDrag || onSlideShortcut || onSlideWheel || editText);
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
  function syncTextMode() {
    if (interactive) frame.current?.contentWindow?.postMessage({
      type: "ir-text-mode", channel: identity.channel, enabled: editText,
    }, "*");
  }
  useEffect(syncTextMode, [interactive, identity.channel, editText]);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width || 0));
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!interactive) return;
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
          "ir-text-select",
        ].includes(e.data.type) ||
        e.data.channel !== identity.channel ||
        e.data.slideId !== slide.slideId
      )
        return;
      if (e.data.type === "ir-text-select") {
        const { id, text, size, bold } = e.data;
        if (typeof id === "string" && /^t\d{1,5}$/.test(id) && typeof text === "string" && Number.isFinite(size) && typeof bold === "boolean") {
          const edit = slide.textEdits?.[id];
          if (!Number.isFinite(e.data.dx) || !Number.isFinite(e.data.dy)) return;
          onText?.({ id, text, size, bold, x: Math.round((edit?.x ?? 0) + e.data.dx), y: Math.round((edit?.y ?? 0) + e.data.dy) });
        }
        return;
      }
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
  }, [identity, interactive, onText, onDrag, onSelect, onSlideShortcut, onSlideWheel, slide, view.imageSlots]);
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
        onLoad={syncTextMode}
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
