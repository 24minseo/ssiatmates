import { useLayoutEffect, useRef, useState } from "react";

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
  const tabsRootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<
    Partial<Record<StatusTabValue, HTMLButtonElement | null>>
  >({});
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    const root = tabsRootRef.current;

    function updateIndicator() {
      const tab = tabRefs.current[selected];

      if (!root || !tab) return;

      const rootRect = root.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      const inset = 12;

      setIndicator({
        left: tabRect.left - rootRect.left + inset,
        width: Math.max(0, tabRect.width - inset * 2),
      });
    }

    updateIndicator();

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateIndicator);

    if (observer) {
      if (root) observer.observe(root);
      Object.values(tabRefs.current).forEach((tab) => {
        if (tab) observer.observe(tab);
      });
    }

    window.addEventListener("resize", updateIndicator);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [selected, counts.all, counts.preparing, counts.submitted]);

  return (
    <div
      ref={tabsRootRef}
      className="relative h-[48px] w-[1200px] shrink-0"
      role="tablist"
      aria-label="지원사업 상태"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-[47px] h-px w-[1208px] bg-field-border"
      />

      <div className="absolute left-[-12px] top-0 flex items-start gap-[10px]">
        {TAB_DEFINITIONS.map((tab) => {
          const isSelected = selected === tab.value;

          return (
            <button
              key={tab.value}
              ref={(node) => {
                tabRefs.current[tab.value] = node;
              }}
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
                    ? "font-semibold text-brand hover:bg-[rgba(234,241,236,0.5)]"
                    : "font-normal text-ink-muted hover:bg-item-hover",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "inline-flex h-6 min-w-6 shrink-0 items-center justify-center overflow-hidden rounded-[13px] px-[7px] py-1 text-[14px] font-semibold",
                    isSelected
                      ? "bg-[#f4f8f5] text-brand"
                      : "bg-item-hover text-ink-muted",
                  )}
                >
                  {counts[tab.value]}
                </span>
              </span>

              <span
                aria-hidden
                className="flex h-[3px] w-full items-start overflow-hidden px-3 opacity-0"
              />
            </button>
          );
        })}
      </div>

      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-[45px] h-[3px] rounded-none bg-brand transition-[left,width,opacity] duration-200 ease-out",
          indicator ? "opacity-100" : "opacity-0",
        )}
        style={
          indicator
            ? { left: indicator.left, width: indicator.width }
            : undefined
        }
      />
    </div>
  );
}
