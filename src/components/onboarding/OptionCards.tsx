import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OptionCardsProps {
  options: readonly string[];
  value: string | null;
  onChange: (value: string) => void;
}

export function OptionCards({ options, value, onChange }: OptionCardsProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {options.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={cn(
              "flex h-12 items-center justify-center gap-1.5 rounded-[12px] border bg-surface px-3 text-sm transition-colors",
              selected
                ? "border-[1.5px] border-brand font-semibold text-brand"
                : "border-field-border text-ink-muted hover:border-brand/40",
            )}
          >
            {selected ? <Check className="size-4" /> : null}
            <span className="text-center leading-tight">{option}</span>
          </button>
        );
      })}
    </div>
  );
}
