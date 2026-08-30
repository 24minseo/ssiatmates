import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FormField } from "./FormField";
import { OptionCards } from "./OptionCards";
import { RegionCombobox } from "./RegionCombobox";
import {
  PRE_FOUNDER,
  STARTUP_STAGES,
  formatBirthDate,
  validateBirthDate,
  type OnboardingState,
} from "./constants";

interface StepBasicInfoProps {
  state: OnboardingState;
  update: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
}

export function StepBasicInfo({ state, update, onNext }: StepBasicInfoProps) {
  const birth = useMemo(() => validateBirthDate(state.birthDate), [state.birthDate]);
  const hasBirthError = birth.complete && !birth.valid;
  const isPreFounder = state.startupStage === PRE_FOUNDER;

  const handleStage = (stage: string) => {
    if (stage === PRE_FOUNDER) {
      update({ startupStage: stage, businessLocation: null, sameAsResidence: false });
    } else {
      update({ startupStage: stage });
    }
  };

  const handleResidence = (region: string) => {
    update({
      residence: region,
      ...(state.sameAsResidence && !isPreFounder ? { businessLocation: region } : {}),
    });
  };

  const handleSame = (checked: boolean) => {
    update({
      sameAsResidence: checked,
      businessLocation: checked ? state.residence : null,
    });
  };

  const canProceed =
    birth.valid &&
    !!state.startupStage &&
    !!state.residence &&
    (isPreFounder || !!state.businessLocation);

  return (
    <div className="flex flex-col gap-8">
      <FormField
        label="생년월일"
        required
        htmlFor="birthDate"
        error={birth.complete && !birth.valid ? (birth.error ?? undefined) : undefined}
      >
        <Input
          id="birthDate"
          inputMode="numeric"
          placeholder="YYYY.MM.DD"
          value={state.birthDate}
          onChange={(event) =>
            update({ birthDate: formatBirthDate(event.target.value) })
          }
          className={cn(
            "h-12 rounded-[12px] bg-surface px-4 text-sm text-ink shadow-none placeholder:text-ink-muted focus-visible:border-[1.5px] focus-visible:ring-[3.2px]",
            hasBirthError
              ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
              : "border-field-border focus-visible:border-brand focus-visible:ring-focus-soft",
          )}
        />

      </FormField>

      <FormField label="창업단계" required>
        <OptionCards
          options={STARTUP_STAGES}
          value={state.startupStage}
          onChange={handleStage}
        />
      </FormField>

      <div className="grid gap-6 md:grid-cols-2">
        <FormField label="거주지역" required htmlFor="residence">
          <RegionCombobox
            id="residence"
            value={state.residence}
            onChange={handleResidence}
          />
        </FormField>

        <FormField
          label="사업장 소재지"
          required={!isPreFounder}
          htmlFor="businessLocation"
          labelRight={
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              <Checkbox
                checked={state.sameAsResidence}
                disabled={isPreFounder}
                onCheckedChange={(checked) => handleSame(checked === true)}
                className="rounded-[5px] border-field-border [&_svg]:size-3 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-brand-foreground"
              />
              거주지역과 동일
            </label>
          }
        >
          <RegionCombobox
            id="businessLocation"
            value={state.businessLocation}
            onChange={(region) => update({ businessLocation: region })}
            disabled={isPreFounder || state.sameAsResidence}
            placeholder={
              isPreFounder ? "사업자 등록 후 입력 가능" : "지역을 선택해주세요"
            }
          />
        </FormField>
      </div>

      <Button
        type="button"
        disabled={!canProceed}
        onClick={onNext}
        className="mt-4 h-12 w-full rounded-[12px] bg-brand text-base font-semibold text-brand-foreground transition-colors hover:bg-brand/88 active:bg-brand-pressed disabled:bg-brand-disabled disabled:text-brand-foreground disabled:opacity-100"
      >
        다음
      </Button>
    </div>
  );
}
