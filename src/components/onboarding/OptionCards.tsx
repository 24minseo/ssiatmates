import { cn } from "@/lib/utils";

interface OptionCardsProps {
  options: readonly string[];
  value: string | null;
  onChange: (value: string) => void;
}

export function OptionCards({ options, value, onChange }: OptionCardsProps) {
  return (
    <div className="grid grid-cols-5 gap-1.5 rounded-[12px] bg-[#F6F8F7] p-1.5">
      {options.map((option) => {
        const selected = value === option;
        const label = option.includes(" ~ ") ? option.replace(" ~ ", "\n~ ") : option;

        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={cn(
              "flex h-[62px] min-w-0 items-center justify-center overflow-hidden rounded-[8px] border border-transparent bg-surface px-1 text-[12px] font-medium leading-[14px] shadow-[0_2px_6px_rgba(85,113,78,0.10)] transition-colors",
              selected
                ? "border-[1.5px] border-brand font-semibold text-brand"
                : "text-[#62756E] hover:border-[#A1DDC8]",
            )}
          >
            <span className="whitespace-pre-line text-center">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
