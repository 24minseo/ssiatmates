import { cn } from "@/lib/utils";

export type StatusTabValue = "all" | "preparing" | "submitted";

type StatusTabsProps = {
  selected: StatusTabValue;
  counts: Record<StatusTabValue, number>;
  onChange: (value: StatusTabValue) => void;
};

const TAB_DEFINITIONS: Array<{
  value: StatusTabValue;
  label: string;
}> = [
  {
    value: "all",
    label: "전체",
  },
  {
    value: "preparing",
    label: "준비 중",
  },
  {
    value: "submitted",
    label: "제출 완료",
  },
];

export function StatusTabs({
  selected,
  counts,
  onChange,
}: StatusTabsProps) {
  return (
    <div
      className="relative h-[48px] w-[1200px] shrink-0"
      role="tablist"
      aria-label="지원사업 상태"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-2px] top-[37px] h-px w-[1208px] bg-field-border"
      />

      <div className="absolute left-[-12px] top-0 flex items-start gap-[6px]">
        {TAB_DEFINITIONS.map((tab) => {
          const isSelected = selected === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onChange(tab.value)}
              className="flex h-[48px] w-max shrink-0 flex-col items-start gap-[5px] rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center gap-[6px] overflow-hidden rounded-[10px] pl-3 pr-1.5 py-2 text-[18px] whitespace-nowrap transition-colors",
                  isSelected
                    ? "bg-[rgba(234,241,236,0.5)] font-semibold text-brand"
                    : "font-normal text-ink-muted hover:bg-item-hover",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "inline-flex h-6 min-w-6 shrink-0 items-center justify-center overflow-hidden rounded-[13px] px-[7px] py-1 text-[14px] font-semibold",
                    isSelected
                      ? "bg-[rgba(234,241,236,0.5)] text-brand"
                      : "bg-item-hover text-ink-muted",
                  )}
                >
                  {counts[tab.value]}
                </span>
              </span>

              <span
                aria-hidden
                className={cn(
                  "flex h-[3px] w-full items-start overflow-hidden",
                  isSelected ? "px-3" : "px-2",
                )}
              >
                <span
                  className={cn(
                    "h-[3px] min-w-px flex-1 transition-opacity duration-200",
                    isSelected ? "bg-brand opacity-100" : "bg-brand opacity-0",
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
