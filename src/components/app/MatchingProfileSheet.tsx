import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  BUSINESS_FIELDS,
  PERSONAL_STATUS_OPTIONS,
  STARTUP_STAGES,
  SUPPORT_CATEGORIES,
  STARTUP_STAGE_CODES,
} from "@/components/onboarding/constants";
import { FormField } from "@/components/onboarding/FormField";
import { MultiSelectDropdown } from "@/components/onboarding/MultiSelectDropdown";
import { OptionCards } from "@/components/onboarding/OptionCards";
import { PillGroup } from "@/components/onboarding/PillGroup";
import { RegionCombobox } from "@/components/onboarding/RegionCombobox";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";

type MatchingProfileSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void | Promise<unknown>;
  profile: {
    id: string;
    birth_date: string | null;
    business_name: string | null;
    startup_stage: string | null;
    residence: string | null;
    business_location: string | null;
    business_fields: string[];
    support_categories: string[];
    personal_statuses: string[];
  } | null;
};

const inputClassName =
  "h-11 w-full rounded-[10px] border border-field-border bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-guide-text focus:border-brand focus:ring-2 focus:ring-focus-soft";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-[20px] font-semibold leading-6 text-ink">{title}</h3>
      <section>{children}</section>
    </div>
  );
}

export function MatchingProfileSheet({ open, onOpenChange, onSaved, profile }: MatchingProfileSheetProps) {
  const [dirty, setDirty] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [startupStage, setStartupStage] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [residence, setResidence] = useState("");
  const [businessLocation, setBusinessLocation] = useState("");
  const [businessLocationAttention, setBusinessLocationAttention] = useState(false);
  const [sameAsResidence, setSameAsResidence] = useState(false);
  const [businessFields, setBusinessFields] = useState<string[]>([]);
  const [supportCategories, setSupportCategories] = useState<string[]>(["전체"]);
  const [personalStatuses, setPersonalStatuses] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const [scrollFades, setScrollFades] = useState({ top: false, bottom: true });

  useEffect(() => {
    if (!open) return;
    setBirthDate(profile?.birth_date?.replace(/-/g, ".") ?? "");
    setBusinessName(profile?.business_name ?? "");
    const savedStage = profile?.startup_stage ?? "";
    setStartupStage(
      STARTUP_STAGES.find((stage) =>
        stage === savedStage ||
        (stage === "예비창업자" && savedStage === "pre_founder") ||
        (stage === "1년 미만" && savedStage === "under_1_year") ||
        (stage === "1년 이상 ~ 3년 미만" && savedStage === "1_to_3_years") ||
        (stage === "3년 이상 ~ 7년 미만" && savedStage === "3_to_7_years") ||
        (stage === "7년 이상" && savedStage === "over_7_years"),
      ) ?? "",
    );
    setResidence(profile?.residence ?? "");
    setBusinessLocation(profile?.business_location ?? "");
    setBusinessLocationAttention(false);
    setSameAsResidence(
      !!profile?.residence && profile.residence === profile.business_location,
    );
    setBusinessFields(profile?.business_fields ?? []);
    setSupportCategories(
      profile?.support_categories?.length ? profile.support_categories : ["전체"],
    );
    setPersonalStatuses(profile?.personal_statuses ?? []);
    setDirty(false);
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    setScrollFades({ top: false, bottom: true });
    let cleanup: (() => void) | undefined;
    const frame = requestAnimationFrame(() => {
      const form = formRef.current;
      if (!form) return;

      const updateScrollFades = () => {
        const hasOverflow = form.scrollHeight > form.clientHeight + 1;
        setScrollFades({
          top: form.scrollTop > 4,
          bottom:
            !hasOverflow || form.scrollTop + form.clientHeight < form.scrollHeight - 4,
        });
      };

      updateScrollFades();
      form.addEventListener("scroll", updateScrollFades, { passive: true });
      const resizeObserver = new ResizeObserver(updateScrollFades);
      resizeObserver.observe(form);

      cleanup = () => {
        form.removeEventListener("scroll", updateScrollFades);
        resizeObserver.disconnect();
      };
    });

    return () => {
      cancelAnimationFrame(frame);
      cleanup?.();
    };
  }, [open, profile]);

  const markDirty = () => setDirty(true);
  const isPreFounder = startupStage === "예비창업자";
  const canSave = dirty && (isPreFounder || businessLocation.trim().length > 0);

  const toggleSupportCategory = (category: string) => {
    if (category === "전체") {
      setSupportCategories(["전체"]);
      markDirty();
      return;
    }
    const current = supportCategories.filter((item) => item !== "전체");
    const next = current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category];
    setSupportCategories(next.length ? next : ["전체"]);
    markDirty();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profile) return;

    const stageCode = STARTUP_STAGE_CODES[startupStage] ?? startupStage;
    const regionNames = [residence, businessLocation].filter(Boolean);
    const { data: regionRows, error: regionError } = await supabase
      .from("onboarding_regions")
      .select("region_code, region_name")
      .in("region_name", regionNames);

    if (regionError) {
      console.error("[matching-profile] 지역 조회 실패", regionError);
      return;
    }

    const regionCodes = new Map(
      (regionRows ?? []).map((row) => [row.region_name, row.region_code]),
    );
    const residenceCode = regionCodes.get(residence) ?? residence;
    const businessCode = regionCodes.get(businessLocation) ?? businessLocation;
    const { error } = await supabase.rpc("complete_onboarding", {
      p_birth_date: birthDate ? birthDate.replace(/\./g, "-") : null,
      p_business_name: businessName.trim(),
      p_founding_stage: stageCode || null,
      p_residence_region: residenceCode || null,
      p_business_region: stageCode === "pre_founder" ? null : businessCode || null,
      p_industries: businessFields,
      p_personal_statuses: personalStatuses,
      p_support_interests: supportCategories,
    });

    if (error) {
      console.error("[matching-profile] 저장 실패", error);
      return;
    }

    setDirty(false);
    await onSaved?.();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-l-0 bg-surface p-0 sm:max-w-[620px] [&>button]:right-6 [&>button]:top-6 [&>button]:flex [&>button]:size-9 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-lg [&>button]:opacity-100 [&>button]:text-ink-muted [&>button[data-state=open]]:!bg-transparent [&>button:focus]:!outline-none [&>button:focus]:!ring-0 [&>button:focus]:!ring-offset-0 [&>button:focus-visible]:!outline-none [&>button:focus-visible]:!ring-0 [&>button:focus-visible]:!ring-offset-0 [&>button:hover]:bg-item-hover [&>button:hover]:text-ink [&>button>svg]:size-6"
      >
        <div className="flex h-full min-h-0 flex-col">
          <SheetHeader className="shrink-0 px-7 pb-7 pt-7 pr-20 text-left">
            <SheetTitle className="text-[22px] font-bold text-ink">매칭 프로필 설정</SheetTitle>
          </SheetHeader>

          <div className="relative min-h-0 flex-1">
            <form
              ref={formRef}
              id="matching-profile-form"
              onSubmit={handleSubmit}
              className="h-full overflow-y-auto bg-surface px-7 pb-6 pt-0"
            >
              <div className="flex flex-col gap-7">
              <div
                role="tablist"
                aria-label="매칭 프로필"
                className={`relative sticky top-0 z-20 -mx-7 mt-0 flex items-end gap-4 bg-item-hover px-7 pt-2 sm:grid sm:grid-cols-2 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-16 after:h-16 after:bg-[linear-gradient(to_bottom,var(--surface)_0%,var(--surface)_28%,rgba(255,255,255,0)_100%)] after:transition-opacity after:duration-200 ${scrollFades.top ? "after:opacity-100" : "after:opacity-0"}`}
              >
                <div className="relative isolate z-0 min-w-0 max-w-[274px] flex-1 sm:-ml-4 sm:max-w-none">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-t-[12px] shadow-[0_0_30px_-8px_rgba(64,72,66,0.12)] [clip-path:inset(-30px_-30px_0_-30px)]"
                  />
                  <div
                    role="tab"
                    aria-selected="true"
                    className="relative z-10 -mb-px flex h-12 w-full items-center rounded-t-[12px] bg-surface before:pointer-events-none before:absolute before:bottom-0 before:-left-3 before:size-3 before:rounded-br-[12px] before:shadow-[6px_6px_0_6px_var(--surface)] after:pointer-events-none after:absolute after:bottom-0 after:-right-3 after:size-3 after:rounded-bl-[12px] after:shadow-[-6px_6px_0_6px_var(--surface)]"
                  >
                    <input
                      id="matching-business-name"
                      name="matching-profile-name"
                      type="text"
                      aria-label="프로필 이름"
                      placeholder="사업·프로젝트 이름 입력"
                      autoComplete="on"
                      className="h-full min-w-0 flex-1 bg-transparent px-4 text-[15px] text-ink outline-none placeholder:text-guide-text"
                      value={businessName}
                      onChange={(event) => {
                        setBusinessName(event.target.value);
                        markDirty();
                      }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="프로필 추가"
                  disabled
                  className="inline-flex h-12 shrink-0 cursor-not-allowed items-center gap-1.5 rounded-t-[10px] bg-transparent px-4 text-[14px] font-semibold text-guide-text sm:-translate-x-4 sm:justify-self-start"
                >
                  <X aria-hidden className="size-4 rotate-45" strokeWidth={2.5} />
                  <span className="text-[15px]">추가</span>
                </button>
              </div>

              <Section title="기본 정보">
                <div className="flex flex-col gap-4">
                  <FormField label="생년월일" required labelVariant="muted2">
                    <Input
                      inputMode="numeric"
                      placeholder="YYYY.MM.DD"
                      className="h-12 rounded-[12px] border-field-border bg-surface px-4 text-[15px] text-ink shadow-none placeholder:text-guide-text focus-visible:border-[1.5px] focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft"
                      value={birthDate}
                      onChange={(event) => {
                        setBirthDate(event.target.value);
                        markDirty();
                      }}
                    />
                  </FormField>
                  <FormField label="신분" required labelVariant="muted2">
                    <MultiSelectDropdown
                      options={PERSONAL_STATUS_OPTIONS}
                      value={personalStatuses}
                      maxSelected={2}
                      listHeight={208}
                      alwaysShowScrollbar
                      scrollSelectedToTop
                      placeholder="신분을 선택해주세요 (최대 2개)"
                      onChange={(value) => {
                        setPersonalStatuses(value);
                        markDirty();
                      }}
                    />
                  </FormField>
                  <FormField label="창업단계" required labelVariant="muted2">
                    <OptionCards
                      options={STARTUP_STAGES}
                      value={startupStage || null}
                      onChange={(value) => {
                        setStartupStage(value);
                        if (value === "예비창업자") {
                          setBusinessLocation("");
                          setSameAsResidence(false);
                          setBusinessLocationAttention(false);
                        } else if (!businessLocation.trim()) {
                          setBusinessLocationAttention(true);
                          requestAnimationFrame(() => {
                            document.getElementById("matching-business-location")?.focus();
                          });
                        }
                        markDirty();
                      }}
                    />
                  </FormField>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <FormField label="거주지역" required labelVariant="muted2">
                    <RegionCombobox
                      value={residence || null}
                      listHeight={208}
                      alwaysShowScrollbar
                      onChange={(value) => {
                        setResidence(value);
                        markDirty();
                      }}
                    />
                  </FormField>
                  <FormField
                    label="사업장 소재지"
                    required={!isPreFounder}
                    labelVariant="muted2"
                    labelRight={
                      <label className="flex items-center gap-2 text-[12px] text-ink">
                        <Checkbox
                          checked={sameAsResidence}
                          disabled={isPreFounder}
                          onCheckedChange={(checked) => {
                            setSameAsResidence(checked === true);
                            if (checked === true) {
                              setBusinessLocation(residence);
                              setBusinessLocationAttention(false);
                            }
                            markDirty();
                          }}
                          className="size-[18px] rounded-[5px] border-field-border [&_svg]:size-3 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-brand-foreground"
                        />
                        거주지역과 동일
                      </label>
                    }
                  >
                    <RegionCombobox
                      id="matching-business-location"
                      value={businessLocation || null}
                      highlighted={businessLocationAttention}
                      listHeight={208}
                      alwaysShowScrollbar
                      onChange={(value) => {
                        setBusinessLocation(value);
                        setBusinessLocationAttention(false);
                        markDirty();
                      }}
                      disabled={isPreFounder || sameAsResidence}
                      placeholder={isPreFounder ? "사업자 등록 후 입력 가능" : undefined}
                    />
                  </FormField>
                </div>
              </Section>

              <div aria-hidden="true" className="-mx-7 h-2 bg-[#F8FAF9]" />

              <Section title="사업 및 관심 정보">
                <div className="flex flex-col gap-4">
                  <FormField label="사업 분야" required labelVariant="muted2">
                    <MultiSelectDropdown
                      options={BUSINESS_FIELDS}
                      value={businessFields}
                      listHeight={208}
                      alwaysShowScrollbar
                      scrollSelectedToTop
                      placeholder="사업 분야를 선택해주세요"
                      onChange={(value) => {
                        setBusinessFields(value);
                        markDirty();
                      }}
                    />
                  </FormField>
                </div>
                <div className="pt-4">
                  <FormField label="관심 지원 분야" labelVariant="muted2">
                    <PillGroup
                      options={SUPPORT_CATEGORIES}
                      value={supportCategories}
                      onToggle={toggleSupportCategory}
                    />
                  </FormField>
                </div>
              </Section>
              </div>
            </form>
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 transition-opacity duration-200 ease-out ${
                scrollFades.bottom ? "opacity-100" : "opacity-0"
              }`}
              style={{
                background: "linear-gradient(to top, rgba(255,255,255,1), rgba(255,255,255,0))",
              }}
            />
          </div>

          <SheetFooter className="shrink-0 bg-surface px-7 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-11 rounded-[12px] bg-secondary-btn px-5 text-[15px] font-semibold text-secondary-btn-text shadow-none transition-colors hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover"
            >
              취소
            </button>
            <button
              type="submit"
              form="matching-profile-form"
              disabled={!canSave}
              className="h-11 rounded-[10px] bg-brand px-5 text-[15px] font-semibold text-brand-foreground transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-brand-disabled disabled:text-brand-foreground"
            >
              변경사항 저장
            </button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
