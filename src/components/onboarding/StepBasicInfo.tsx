import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
  const [birthTouched, setBirthTouched] = useState(false);
  const birthInputRef = useRef<HTMLInputElement>(null);
  const pendingBirthCaretRef = useRef<number | null>(null);
  const birth = useMemo(() => validateBirthDate(state.birthDate), [state.birthDate]);
  const birthError = birthTouched
    ? state.birthDate.length === 0
      ? "생년월일을 입력해주세요."
      : !birth.complete
        ? "생년월일 8자리를 입력해주세요."
        : birth.error
    : null;
  const hasBirthError = !!birthError;
  const isPreFounder = state.startupStage === PRE_FOUNDER;

  useLayoutEffect(() => {
    const caret = pendingBirthCaretRef.current;
    const input = birthInputRef.current;
    if (caret === null || !input) return;

    input.setSelectionRange(caret, caret);
    pendingBirthCaretRef.current = null;
  }, [state.birthDate]);

  const handleBirthChange = (rawValue: string, selectionStart: number | null) => {
    const rawCaret = selectionStart ?? rawValue.length;
    const digitsBeforeCaret = rawValue.slice(0, rawCaret).replace(/\D/g, "").length;
    const formatted = formatBirthDate(rawValue);

    let formattedCaret = 0;
    let seenDigits = 0;
    while (formattedCaret < formatted.length && seenDigits < digitsBeforeCaret) {
      if (/\d/.test(formatted.charAt(formattedCaret))) seenDigits += 1;
      formattedCaret += 1;
    }

    pendingBirthCaretRef.current = formattedCaret;
    setBirthTouched(false);
    update({ birthDate: formatted });
  };

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
    <div className="flex flex-col gap-6">
      <FormField
        label="생년월일"
        required
        htmlFor="birthDate"
        error={birthError ?? undefined}
      >
        <Input
          ref={birthInputRef}
          id="birthDate"
          inputMode="numeric"
          placeholder="YYYY.MM.DD"
          value={state.birthDate}
          onChange={(event) =>
            handleBirthChange(event.target.value, event.target.selectionStart)
          }
          onBlur={() => setBirthTouched(true)}
          className={cn(
            "h-12 rounded-[12px] bg-surface px-4 text-[15px] text-ink shadow-none placeholder:text-placeholder focus-visible:border-[1.5px] focus-visible:ring-[3.2px]",
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

      <div className="grid gap-x-3 gap-y-6 md:grid-cols-2">
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
            <label className="flex items-center gap-2 text-[12px] text-ink">
              <Checkbox
                checked={state.sameAsResidence}
                disabled={isPreFounder}
                onCheckedChange={(checked) => handleSame(checked === true)}
                className="size-[18px] rounded-[5px] border-field-border [&_svg]:size-3 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-brand-foreground"
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
        className="mt-10 h-12 w-full rounded-[12px] bg-brand text-base font-semibold shadow-primary-button text-brand-foreground transition-colors hover:bg-brand/88 active:bg-brand-pressed disabled:bg-brand-disabled disabled:text-brand-foreground disabled:opacity-100"
      >
        다음
      </Button>
    </div>
  );
}
