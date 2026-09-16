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
  itemClass: string;
  indicatorClass: string;
}> = [
  {
    value: "all",
    label: "전체",
    itemClass: "left-[-12px] w-[79px]",
    indicatorClass: "left-0 w-[55px]",
  },
  {
    value: "preparing",
    label: "준비 중",
    itemClass: "left-[78px] w-[97px]",
    indicatorClass: "left-[90px] w-[75px]",
  },
  {
    value: "submitted",
    label: "제출 완료",
    itemClass: "left-[186px] w-[113px]",
    indicatorClass: "left-[198px] w-[91px]",
  },
];

export function StatusTabs({
  selected,
  counts,
  onChange,
}: StatusTabsProps) {
  const activeTab =
    TAB_DEFINITIONS.find((tab) => tab.value === selected) ??
    TAB_DEFINITIONS[0]!;

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

      {TAB_DEFINITIONS.map((tab) => {
        const isSelected = selected === tab.value;

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(tab.value)}
            className={cn(
              "absolute top-0 flex h-[48px] flex-col items-start gap-[5px] rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              tab.itemClass,
            )}
          >
            <span
              className={cn(
                "inline-flex h-[40px] items-center gap-[4px] whitespace-nowrap rounded-[10px] pl-2 pr-0 py-2 text-[18px] transition-colors",
                isSelected
                  ? "bg-[rgba(234,241,236,0.5)] font-semibold text-brand hover:bg-item-hover-selected"
                  : "font-normal text-ink-muted hover:bg-item-hover",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "inline-flex size-6 min-w-6 shrink-0 items-center justify-center rounded-[13px] px-0 py-0 text-[14px] font-semibold",
                  isSelected
                    ? "bg-transparent text-brand"
                    : "bg-item-hover text-ink-muted",
                )}
              >
                {counts[tab.value]}
              </span>
            </span>
          </button>
        );
      })}

      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-[45px] h-[3px] rounded-none bg-brand transition-[left,width] duration-200 ease-out",
          activeTab.indicatorClass,
        )}
      />
    </div>
  );
}
