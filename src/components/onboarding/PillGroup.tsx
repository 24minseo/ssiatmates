import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PillGroupProps {
  options: readonly string[];
  value: string[];
  onToggle: (option: string) => void;
}

export function PillGroup({ options, value, onToggle }: PillGroupProps) {
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
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-colors",
              selected
                ? "bg-pill font-semibold text-pill-foreground"
                : "bg-[#F8F8F8] text-ink-muted hover:bg-muted/70",
            )}
          >
            {selected ? <Check aria-hidden className="size-3.5" strokeWidth={2.5} /> : null}
            <span>{option}</span>
          </button>
        );
      })}
    </div>
  );
}
