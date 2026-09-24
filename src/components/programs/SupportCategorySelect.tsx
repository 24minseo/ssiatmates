import { useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { DropdownChevron } from "@/components/ui/DropdownChevron";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PillGroup } from "@/components/onboarding/PillGroup";
import { SUPPORT_CATEGORIES, SUPPORT_ALL } from "@/components/onboarding/constants";
import { useAuth } from "@/hooks/useAuth";

type SupportCategorySelectProps = {
  value: string[];
  onChange: (value: string[]) => void;
};

function normalizedValue(value: string[]) {
  return value.length > 0 ? value : [SUPPORT_ALL];
}

function SquareAlertIcon({
  className,
  variant = "fill",
}: {
  className?: string;
  variant?: "fill" | "line";
}) {
  const isLine = variant === "line";

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={className}>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4"
        fill={isLine ? "none" : "currentColor"}
        stroke={isLine ? "currentColor" : "none"}
        strokeWidth={isLine ? "1.75" : undefined}
      />
      <path
        d="M12 7.5V12.75"
        stroke={isLine ? "currentColor" : "var(--surface)"}
        strokeWidth={isLine ? "2" : "2.5"}
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.75" r={isLine ? "1.15" : "1.4"} fill={isLine ? "currentColor" : "var(--surface)"} />
    </svg>
  );
}

export function SupportCategorySelect({ value, onChange }: SupportCategorySelectProps) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [showNotice, setShowNotice] = useState(true);
  const [draftValue, setDraftValue] = useState(normalizedValue(value));
  const profileSelection = normalizedValue(profile?.support_categories ?? []);
  const visible = value.includes(SUPPORT_ALL)
    ? "전체 지원 분야"
    : value.length > 0
      ? value[0] + (value.length > 1 ? ` 외 ${value.length - 1}개` : "")
      : "전체 지원 분야";

  const toggle = (option: string) => {
    if (option === SUPPORT_ALL) {
      setDraftValue([SUPPORT_ALL]);
      return;
    }

    const next = draftValue.filter((item) => item !== SUPPORT_ALL);
    const updated = next.includes(option)
      ? next.filter((item) => item !== option)
      : [...next, option];
    setDraftValue(updated.length > 0 ? updated : [SUPPORT_ALL]);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setDraftValue(normalizedValue(value));
    setOpen(nextOpen);
  };

  const apply = () => {
    onChange(draftValue);
    setOpen(false);
  };

  const resetToProfile = () => {
    setDraftValue(profileSelection);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          className="flex h-12 w-full items-center justify-between rounded-xl border border-border bg-white px-6 text-left text-[15px] font-medium text-ink transition-colors hover:bg-item-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span>{visible}</span>
          <DropdownChevron open={open} variant="default" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-[560px] max-w-[calc(100vw-32px)] rounded-xl border-0 bg-white p-6 shadow-dropdown"
      >
        {showNotice ? (
          <div className="mb-4 flex items-center gap-2 rounded-[8px] bg-item-hover px-3 py-2.5 text-[14px] font-normal leading-5 text-ink-muted">
            <SquareAlertIcon variant="fill" className="size-4 shrink-0 text-icon-muted" />
            <span className="min-w-0 flex-1 break-keep">
              이번 탐색에만 적용되며, MY홈 추천 기준은 변하지 않습니다.
            </span>
            <button
              type="button"
              aria-label="안내 닫기"
              onClick={() => setShowNotice(false)}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-[4px] text-icon-muted transition-colors hover:bg-transparent hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ) : null}

        <div className="mb-3 flex items-center">
          <p className="text-[16px] font-semibold leading-5 text-ink">지원 분야 필터</p>
        </div>

        <PillGroup options={SUPPORT_CATEGORIES} value={draftValue} onToggle={toggle} />

        <div className="mt-5 flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={resetToProfile}
            className="inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-[10px] px-2 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink hover:underline hover:underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <RotateCcw aria-hidden className="size-3.5" strokeWidth={2} />
            선택 초기화
          </button>
          <button
            type="button"
            onClick={apply}
            className="h-10 shrink-0 rounded-[10px] bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#3A8F77] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {draftValue.includes(SUPPORT_ALL)
              ? "전체 분야 적용"
              : `${draftValue.length}개 분야 적용`}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
