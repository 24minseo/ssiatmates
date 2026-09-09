import { Button } from "@/components/ui/button";
import { FormField } from "./FormField";
import { MultiSelectDropdown } from "./MultiSelectDropdown";
import { PillGroup } from "./PillGroup";
import {
  BUSINESS_FIELDS,
  SUPPORT_ALL,
  SUPPORT_CATEGORIES,
  type OnboardingState,
} from "./constants";

interface StepBusinessInfoProps {
  state: OnboardingState;
  update: (patch: Partial<OnboardingState>) => void;
  onPrev: () => void;
  onComplete: () => void;
}

export function StepBusinessInfo({
  state,
  update,
  onPrev,
  onComplete,
}: StepBusinessInfoProps) {
  const toggleCategory = (option: string) => {
    if (option === SUPPORT_ALL) {
      update({ supportCategories: [SUPPORT_ALL] });
      return;
    }
    const current = state.supportCategories.filter((item) => item !== SUPPORT_ALL);
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];
    update({ supportCategories: next.length === 0 ? [SUPPORT_ALL] : next });
  };

  return (
    <div className="flex flex-col gap-6">
      <FormField label="사업분야" required htmlFor="businessFields">
        <MultiSelectDropdown
          id="businessFields"
          options={BUSINESS_FIELDS}
          value={state.businessFields}
          onChange={(value) => update({ businessFields: value })}
          placeholder="사업분야를 선택해주세요"
        />
      </FormField>

      <FormField label="관심 카테고리">
        <PillGroup
          options={SUPPORT_CATEGORIES}
          value={state.supportCategories}
          onToggle={toggleCategory}
        />
      </FormField>

      <div className="mt-10 flex gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onPrev}
          className="h-12 flex-1 rounded-[12px] border-0 bg-secondary-btn text-base font-semibold text-secondary-btn-text transition-colors hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover"
        >
          이전
        </Button>
        <Button
          type="button"
          disabled={state.businessFields.length === 0}
          onClick={onComplete}
          className="h-12 flex-1 rounded-[12px] bg-brand text-base font-semibold shadow-primary-button text-brand-foreground transition-colors hover:bg-brand/88 active:bg-brand-pressed disabled:bg-brand-disabled disabled:text-brand-foreground disabled:opacity-100"
        >
          완료
        </Button>
      </div>
    </div>
  );
}
