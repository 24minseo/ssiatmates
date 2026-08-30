import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { StepBasicInfo } from "@/components/onboarding/StepBasicInfo";
import { StepBusinessInfo } from "@/components/onboarding/StepBusinessInfo";
import {
  initialOnboardingState,
  type OnboardingState,
} from "@/components/onboarding/constants";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "온보딩 · 창업 지원사업 매칭" },
      {
        name: "description",
        content:
          "생년월일, 창업단계, 지역, 사업분야와 지원카테고리를 입력해 맞춤 창업 지원사업을 추천받으세요.",
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

  const update = (patch: Partial<OnboardingState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4 py-12">
      <div className="w-full max-w-[542px] rounded-[20px] bg-surface px-6 py-10 shadow-sm sm:px-12 sm:py-14">
        <header className="mb-10">
          <div className="relative mb-2 inline-flex h-5 w-7 items-center justify-center rounded-[4px] bg-pill">
            <span className="text-[11px] font-semibold leading-none tracking-tight text-brand">
              {step}/2
            </span>
            <span
              aria-hidden
              className="absolute -bottom-[5px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-4 border-t-[6px] border-x-transparent border-t-pill"
            />
          </div>
          <h1 className="mt-2 text-2xl font-bold text-ink">
            {step === 1 ? "기본 정보" : "사업 및 매칭 정보"}
          </h1>

          <p
            className={`mt-2 text-sm ${step === 1 ? "text-[#9A9D9B]" : "text-ink-muted"}`}
          >
            {step === 1
              ? "맞춤 지원사업 추천을 위해 기본 정보를 입력해주세요."
              : "관심 있는 사업분야와 지원카테고리를 선택해주세요."}
          </p>
        </header>

        {step === 1 ? (
          <StepBasicInfo state={state} update={update} onNext={() => setStep(2)} />
        ) : (
          <StepBusinessInfo
            state={state}
            update={update}
            onPrev={() => setStep(1)}
            onComplete={() => toast.success("온보딩이 완료되었습니다.")}
          />
        )}
      </div>
      <Toaster />
    </main>
  );
}
