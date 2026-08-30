import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OptionCardsProps {
  options: readonly string[];
  value: string | null;
  onChange: (value: string) => void;
}

export function OptionCards({ options, value, onChange }: OptionCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {options.map((option, index) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={cn(
              "flex h-12 items-center justify-center gap-1.5 rounded-xl border bg-surface px-3 text-sm transition-colors",
              index === 0 ? "col-span-2" : "col-span-1",
              index >= 3 && "sm:col-span-2",
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
