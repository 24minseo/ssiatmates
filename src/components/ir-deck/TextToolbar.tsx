import { cn } from "@/lib/utils";
import type { TextFormat } from "./model";

export function TextToolbar({
  format,
  onChange,
  onBullets,
}: {
  format: TextFormat;
  onChange: (patch: Partial<TextFormat>) => void;
  onBullets: () => void;
}) {
  const input = "rounded border border-field-border bg-surface p-2 text-sm text-ink";
  return (
    <div
      role="toolbar"
      aria-label="글자 편집 도구"
      className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-field-border bg-surface p-3 text-sm text-ink"
    >
      <select
        className={input}
        aria-label="글꼴"
        value={format.font}
        onChange={(e) => onChange({ font: e.target.value })}
      >
        {["Asta Sans", "Arial", "Georgia", "Times New Roman", "Malgun Gothic"].map((font) => (
          <option key={font}>{font}</option>
        ))}
      </select>
      <button
        type="button"
        className={input}
        aria-label="글자 작게"
        onClick={() => onChange({ size: Math.max(12, format.size - 2) })}
      >
        −
      </button>
      <input
        className={cn(input, "w-16")}
        type="number"
        min={12}
        max={72}
        aria-label="글자 크기"
        value={format.size}
        onChange={(e) =>
          onChange({ size: Math.max(12, Math.min(72, Number(e.target.value) || 20)) })
        }
      />
      <button
        type="button"
        className={input}
        aria-label="글자 크게"
        onClick={() => onChange({ size: Math.min(72, format.size + 2) })}
      >
        ＋
      </button>
      <label className="flex items-center gap-1">
        글자 색
        <input
          type="color"
          aria-label="글자 색"
          value={format.color || ""}
          onChange={(e) => onChange({ color: e.target.value })}
        />
      </label>
      {(
        [
          ["bold", "굵게", "B"],
          ["italic", "기울임", "I"],
          ["underline", "밑줄", "U"],
          ["strike", "취소선", "S"],
        ] as const
      ).map(([key, label, text]) => (
        <button
          type="button"
          key={key}
          aria-label={label}
          aria-pressed={format[key]}
          className={cn(input, format[key] && "border-brand bg-item-hover-selected text-brand")}
          onClick={() => onChange({ [key]: !format[key] })}
        >
          {text}
        </button>
      ))}
      {(
        [
          ["left", "왼쪽"],
          ["center", "가운데"],
          ["right", "오른쪽"],
          ["justify", "양쪽"],
        ] as const
      ).map(([align, label]) => (
        <button
          type="button"
          key={align}
          aria-label={`${label} 정렬`}
          aria-pressed={format.align === align}
          className={cn(
            input,
            format.align === align && "border-brand bg-item-hover-selected text-brand",
          )}
          onClick={() => onChange({ align })}
        >
          {label}
        </button>
      ))}
      <button type="button" className={input} onClick={onBullets}>
        • 본문 글머리표
      </button>
      <label>
        줄 간격{" "}
        <select
          className={input}
          aria-label="줄 간격"
          value={format.lineHeight}
          onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
        >
          {[1.2, 1.5, 1.8, 2].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <label>
        자간{" "}
        <select
          className={input}
          aria-label="자간"
          value={format.letterSpacing}
          onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
        >
          {[0, 1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}px
            </option>
          ))}
        </select>
      </label>
      <label>
        투명도{" "}
        <select
          className={input}
          aria-label="투명도"
          value={format.opacity}
          onChange={(e) => onChange({ opacity: Number(e.target.value) })}
        >
          {[100, 80, 60, 40].map((n) => (
            <option key={n} value={n}>
              {n}%
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
