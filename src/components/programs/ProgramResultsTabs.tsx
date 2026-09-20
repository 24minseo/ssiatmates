import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ProgramResultsTab = "recommended" | "review";

type ProgramResultsTabsProps = {
  selected: ProgramResultsTab;
  counts: Record<ProgramResultsTab, number>;
  onChange: (value: ProgramResultsTab) => void;
};

const tabs: Array<{ value: ProgramResultsTab; label: string }> = [
  { value: "recommended", label: "맞춤 공고" },
  { value: "review", label: "추가 검토 필요" },
];

export function ProgramResultsTabs({ selected, counts, onChange }: ProgramResultsTabsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Partial<Record<ProgramResultsTab, HTMLButtonElement | null>>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const root = rootRef.current;
      const tab = refs.current[selected];
      if (!root || !tab) return;
      const rootRect = root.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      setIndicator({ left: tabRect.left - rootRect.left + 12, width: Math.max(0, tabRect.width - 24) });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [selected, counts.recommended, counts.review]);

  return (
    <div ref={rootRef} className="relative h-[48px] w-[1200px] shrink-0" role="tablist" aria-label="지원사업 결과">
      <div aria-hidden className="pointer-events-none absolute left-0 top-[47px] h-[1.5px] w-[1208px] bg-field-border" />
      <div className="absolute left-[-12px] top-0 flex items-start gap-[10px]">
        {tabs.map((tab) => {
          const isSelected = selected === tab.value;
          return (
            <button key={tab.value} ref={(node) => { refs.current[tab.value] = node; }} type="button" role="tab" aria-selected={isSelected} onClick={() => onChange(tab.value)} className="flex h-[48px] w-max shrink-0 flex-col items-start gap-[5px] rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              <span className={cn("inline-flex items-center justify-center gap-[6px] overflow-hidden rounded-[10px] pl-3 pr-1.5 py-2 text-[18px] whitespace-nowrap", isSelected ? "font-semibold text-brand hover:bg-[rgba(234,241,236,0.5)]" : "font-normal text-ink-muted hover:bg-item-hover")}>
                {tab.label}
                <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-[13px] px-[7px] py-1 text-[14px] font-medium", isSelected ? "bg-[#f4f8f5] text-brand" : "bg-item-hover text-ink-muted")}>{counts[tab.value]}</span>
              </span>
              <span aria-hidden className="flex h-[3px] w-full px-3 opacity-0" />
            </button>
          );
        })}
      </div>
      <span aria-hidden className={cn("pointer-events-none absolute top-[45px] h-[3px] bg-brand transition-[left,width] duration-200 ease-out", indicator ? "opacity-100" : "opacity-0")} style={indicator ?? undefined} />
    </div>
  );
}
