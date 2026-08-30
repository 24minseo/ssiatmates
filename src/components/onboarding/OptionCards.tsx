import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OptionCardsProps {
  options: readonly string[];
  value: string | null;
  onChange: (value: string) => void;
}

export function OptionCards({ options, value, onChange }: OptionCardsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={cn(
              "flex h-12 flex-1 min-w-[128px] items-center justify-center gap-1.5 rounded-xl border bg-surface px-3 text-sm transition-colors",
              selected
                ? "border-brand font-semibold text-brand"
                : "border-field-border text-ink-muted hover:border-brand/40",
            )}
          >
            {selected ? <Check className="size-4" /> : null}
            <span className="whitespace-nowrap">{option}</span>
          </button>
        );
      })}
    </div>
  );
}
