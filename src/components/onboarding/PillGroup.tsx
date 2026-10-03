import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PillGroupProps {
  options: readonly string[];
  value: string[];
  onToggle: (option: string) => void;
  variant?: "default" | "filter" | "filter-filled";
}

export function PillGroup({ options, value, onToggle, variant = "default" }: PillGroupProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(option)}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center rounded-full px-3 text-sm transition-[background-color,border-color,color,gap] duration-200",
              selected
                ? cn(
                    "gap-[4px] bg-pill font-semibold text-pill-foreground",
                    variant === "filter"
                      ? "border border-icon-muted"
                      : variant === "filter-filled"
                        ? "border border-transparent"
                        : null,
                  )
                : variant === "filter-filled"
                  ? "gap-0 border border-icon-muted/20 bg-item-hover/50 text-ink-muted hover:bg-[#F1F3F2] hover:text-ink"
                  : variant === "filter"
                    ? "gap-0 border border-icon-muted bg-white text-ink-muted hover:bg-[#F7FAF8] hover:text-ink"
                  : "gap-0 bg-item-hover text-ink-muted hover:bg-[#F1F3F2] hover:text-ink-muted",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none",
                selected ? "w-3.5 opacity-100" : "w-0 opacity-0",
              )}
            >
              <Check className="size-3.5" strokeWidth={2.5} />
            </span>
            <span>{option}</span>
          </button>
        );
      })}
    </div>
  );
}
