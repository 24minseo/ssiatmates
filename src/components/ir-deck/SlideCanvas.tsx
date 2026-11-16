import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { defaultFormat, mediaUrl, themes, videoEmbed, type Slide, type TextFormat } from "./model";

function textStyle(format: TextFormat): CSSProperties {
  return {
    fontFamily: ["Asta Sans", "Arial", "Georgia", "Times New Roman", "Malgun Gothic"].includes(
      format.font,
    )
      ? format.font
      : "Asta Sans",
    fontSize: Math.max(12, Math.min(72, format.size || 20)),
    color: format.color && /^#[0-9a-f]{6}$/i.test(format.color) ? format.color : "inherit",
    fontWeight: format.bold ? 700 : 400,
    fontStyle: format.italic ? "italic" : "normal",
    textDecorationLine:
      [format.underline && "underline", format.strike && "line-through"]
        .filter(Boolean)
        .join(" ") || "none",
    textAlign: format.align,
    lineHeight: format.lineHeight,
    letterSpacing: format.letterSpacing,
    opacity: Math.max(30, Math.min(100, format.opacity ?? 100)) / 100,
  };
}
export function SlideCanvas({
  slide,
  theme,
  editable = false,
  activeField,
  onFocus,
  onText,
  onRemove,
  className,
}: {
  slide: Slide;
  theme: string;
  editable?: boolean;
  activeField?: string;
  onFocus?: (field: string) => void;
  onText?: (field: string, value: string) => void;
  onRemove?: (id: string) => void;
  className?: string;
}) {
  const isEmptyState = slide.body.startsWith("문서에서 확인된 내용이 없습니다.");
  const block = (field: string, text: string) => {
    const style = textStyle(slide.formats[field] || defaultFormat(field));
    const displayStyle = isEmptyState ? { ...style, textAlign: "center" as const } : style;
    return editable ? (
      <textarea
        aria-label={
          field === "title"
            ? "슬라이드 제목"
            : field === "body"
              ? "슬라이드 본문"
              : "추가한 텍스트 상자"
        }
        value={text}
        onFocus={() => onFocus?.(field)}
        onChange={(e) => onText?.(field, e.target.value)}
        rows={Math.max(field === "title" ? 1 : 2, text.split("\n").length)}
        style={displayStyle}
        className={cn(
          "ir-deck-text w-full resize-y rounded bg-transparent outline-none focus:ring-2 focus:ring-brand",
          activeField === field && "ring-1 ring-brand",
        )}
      />
    ) : (
      <div className="ir-deck-text whitespace-pre-wrap break-words" style={displayStyle}>
        {text}
      </div>
    );
  };
  return (
    <div
      className={cn(
        "ir-deck-slide mx-auto flex aspect-video w-full flex-col justify-center gap-4 border border-field-border p-[7%] shadow-sm",
        className,
        isEmptyState ? "bg-surface text-ink" : themes.find(([name]) => name === theme)?.[2],
      )}
    >
      <div className={cn("h-1 w-10 shrink-0 bg-current opacity-70", isEmptyState && "mx-auto")} />
      {block("title", slide.title)}
      {block("body", slide.body)}
      {slide.elements.map((element) => (
        <div key={element.id} className="group relative min-w-0">
          {element.type === "text" ? (
            block(`extra:${element.id}`, element.text)
          ) : element.type === "image" ? (
            <img
              src={
                element.src.startsWith("data:image/") || mediaUrl(element.src)
                  ? element.src
                  : undefined
              }
              alt="추가한 이미지"
              className="mx-auto max-h-40 max-w-full object-contain"
            />
          ) : (
            <>
              <div className="ir-deck-video mx-auto aspect-video max-h-40">
                {videoEmbed(element.src) ? (
                  <iframe
                    className="h-full w-full"
                    src={videoEmbed(element.src)!}
                    title="추가한 동영상"
                    allowFullScreen
                  />
                ) : (
                  <video
                    className="h-full w-full"
                    src={mediaUrl(element.src) || undefined}
                    controls
                  />
                )}
              </div>
              <p className="break-all text-xs">동영상: {element.src}</p>
            </>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => onRemove?.(element.id)}
              aria-label={
                element.type === "text"
                  ? "텍스트 상자 삭제"
                  : element.type === "image"
                    ? "이미지 삭제"
                    : "동영상 삭제"
              }
              className="mt-1 rounded border border-current px-2 py-1 text-xs"
            >
              삭제
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
