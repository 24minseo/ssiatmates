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
    <div className="flex flex-col gap-8">
      <FormField label="사업분야" required htmlFor="businessFields">
        <MultiSelectDropdown
          id="businessFields"
          options={BUSINESS_FIELDS}
          value={state.businessFields}
          onChange={(value) => update({ businessFields: value })}
          placeholder="사업분야를 선택해주세요"
        />
      </FormField>

      <FormField label="지원카테고리" required>
        <PillGroup
          options={SUPPORT_CATEGORIES}
          value={state.supportCategories}
          onToggle={toggleCategory}
        />
      </FormField>

      <div className="mt-2 flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onPrev}
          className="h-12 flex-1 rounded-xl border-field-border bg-surface text-base font-semibold text-ink-muted hover:bg-muted/50"
        >
          이전
        </Button>
        <Button
          type="button"
          disabled={state.businessFields.length === 0}
          onClick={onComplete}
          className="h-12 flex-[2] rounded-xl bg-brand text-base font-semibold text-brand-foreground hover:bg-brand/90 disabled:bg-muted disabled:text-ink-muted"
        >
          완료
        </Button>
      </div>
    </div>
  );
}
