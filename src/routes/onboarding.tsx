import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StepBasicInfo } from "@/components/onboarding/StepBasicInfo";
import { StepBusinessInfo } from "@/components/onboarding/StepBusinessInfo";
import {
  initialOnboardingState,
  type OnboardingState,
} from "@/components/onboarding/constants";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "온보딩 · 창업 지원사업 매칭" },
      {
        name: "description",
        content:
          "생년월일, 창업단계, 지역, 사업 분야와 관심 지원 분야를 입력해 맞춤 창업 지원사업을 추천받으세요.",
      },
      { property: "og:title", content: "온보딩 · 창업 지원사업 매칭" },
      {
        property: "og:description",
        content: "2단계 온보딩으로 나에게 맞는 창업 지원사업을 매칭받아 보세요.",
      },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [state, setState] = useState<OnboardingState>(initialOnboardingState);
  const [saving, setSaving] = useState(false);
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const update = (patch: Partial<OnboardingState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const handleComplete = async () => {
    if (saving || !user) return;
    setSaving(true);
    const { error: onboardingError } = await supabase
      .from("onboarding_profiles")
      .upsert(
        {
          user_id: user.id,
          birth_date: state.birthDate || null,
          startup_stage: state.startupStage,
          residence: state.residence,
          business_location: state.sameAsResidence
            ? state.residence
            : state.businessLocation,
          business_fields: state.businessFields,
          support_categories: state.supportCategories,
        },
        { onConflict: "user_id" },
      );

    if (onboardingError) {
      console.error("[onboarding] 저장 실패", onboardingError);
      setSaving(false);
      toast.error("정보 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ is_onboarded: true })
      .eq("id", user.id);

    if (error) {
      console.error("[onboarding] 저장 실패", error);
      setSaving(false);
      toast.error("정보 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      return;
    }

    await refreshProfile();
    toast.success("정보 입력이 완료되었어요.");
    void navigate({ to: "/programs", replace: true });
  };


  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4 py-12">
      <div className="w-full max-w-[542px] rounded-[20px] bg-surface px-6 py-10 shadow-surface-card sm:px-12 sm:py-14">
        <header className="mb-10 flex flex-col items-start">
          <div className="relative mb-[9px] inline-flex h-5 w-7 items-center justify-center rounded-[4px] bg-pill">
            <span className="text-[12px] font-semibold leading-none text-brand">
              {step}/2
            </span>
            <span
              aria-hidden
              className="absolute -bottom-[5px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-4 border-t-[6px] border-x-transparent border-t-pill"
            />
          </div>
          <h1 className="text-2xl font-bold text-ink">
            {step === 1 ? "기본 정보" : "사업 및 관심 정보"}
          </h1>

          <p
            className="mt-1 text-sm text-ink-muted"
          >
            {step === 1
              ? "맞춤 지원사업 추천을 위해 기본 정보를 입력해주세요."
              : "관심 있는 사업 분야와 지원 분야를 선택해주세요."}
          </p>
        </header>

        {step === 1 ? (
          <StepBasicInfo state={state} update={update} onNext={() => setStep(2)} />
        ) : (
          <StepBusinessInfo
            state={state}
            update={update}
            onPrev={() => setStep(1)}
            saving={saving}
            onComplete={handleComplete}
          />
        )}
      </div>
      <Toaster />
    </main>
  );
}
