import { useState } from "react";
import { RotateCcw } from "lucide-react";
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

export function SupportCategorySelect({ value, onChange }: SupportCategorySelectProps) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
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
        className="w-[560px] max-w-[calc(100vw-32px)] rounded-xl border-0 bg-white p-6 shadow-dropdown"
      >
        <div className="mb-3">
          <p className="text-[15px] font-semibold leading-5 text-ink">지원 분야 선택</p>
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
