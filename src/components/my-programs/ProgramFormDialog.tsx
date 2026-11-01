import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/onboarding/FormField";
import type {
  Program,
  ProgramInput,
} from "@/services/mockProgramService";
import type {
  ManualNoticeAnalysisOutcome,
  ManualNoticeAnalysisResult,
} from "@/services/manualNoticeAnalysisApi";

type ProgramFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: Program | null;
  saving: boolean;
  onAnalyze?: (inputUrl: string) => Promise<ManualNoticeAnalysisOutcome>;
  onSubmit: (input: ProgramInput) => void;
};

const emptyForm: ProgramInput = {
  title: "",
  organization: "",
  category: "",
  stage: "",
  region: "",
  status: "not_started",
  deadline: "",
};

function toDateInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function ProgramFormDialog({
  open,
  onOpenChange,
  program,
  saving,
  onAnalyze,
  onSubmit,
}: ProgramFormDialogProps) {
  const [form, setForm] = useState<ProgramInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [sourceUrl, setSourceUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ManualNoticeAnalysisResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStep(program ? 2 : 1);
    setSourceUrl("");
    setAnalyzing(false);
    setAnalysisResult(null);
    setForm(
      program
        ? {
            title: program.title,
            organization: program.organization,
            category: program.category,
            stage: program.stage,
            region: program.region,
            status: program.status,
            deadline: toDateInput(program.deadline),
          }
        : emptyForm,
    );
  }, [open, program]);

  const inputClass =
    "h-11 rounded-[12px] border-field-border px-3.5 text-[15px] shadow-none placeholder:text-guide-text focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft";
  const canSubmit =
    step === 1
      ? sourceUrl.trim().length > 0 && !analyzing
      : form.title.trim().length > 0 && Boolean(form.deadline);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[600px] max-w-[calc(100vw-40px)] gap-0 rounded-[20px] border-0 bg-surface p-6"
        closeClassName="right-5 top-5 flex size-9 items-center justify-center rounded-lg text-ink-muted opacity-100 transition-colors hover:bg-item-hover hover:text-ink hover:opacity-100 focus:outline-none focus:ring-0 focus:ring-offset-0 [&_svg]:size-6"
      >
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-[20px] font-bold leading-7 text-ink">
            {program ? "지원사업 수정" : "수동 공고 추가"}
          </DialogTitle>
        </DialogHeader>

        <form
          className="mt-4 space-y-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (saving) return;
            if (step === 1) {
              const trimmedUrl = sourceUrl.trim();
              if (!trimmedUrl) {
                setError("공고 URL을 입력해주세요.");
                return;
              }
              if (!/^https?:\/\//i.test(trimmedUrl)) {
                setError("http:// 또는 https://로 시작하는 URL을 입력해주세요.");
                return;
              }
              setError(null);
              if (!onAnalyze) {
                setStep(2);
                return;
              }
              setAnalyzing(true);
              void onAnalyze(trimmedUrl)
                .then((result) => {
                  if (result.status === "stale") return;
                  setAnalysisResult(result);
                  const notice = result.notice;
                  const readText = (value: unknown) =>
                    typeof value === "string" ? value.trim() : "";
                  const noticeDeadline = readText(notice.deadline);
                  const parsedDeadline = noticeDeadline ? toDateInput(noticeDeadline) : "";
                  setForm({
                    title: readText(notice.title),
                    organization: readText(notice.organization),
                    category: readText(notice.field),
                    stage: "",
                    region: readText(notice.region),
                    status: "not_started",
                    // 분석 결과에 마감일이 없으면 빈 값으로 두고 사용자가 직접 확인합니다.
                    deadline: parsedDeadline,
                  });
                  setStep(2);
                })
                .catch((analysisError: unknown) => {
                  const requestId =
                    typeof analysisError === "object" && analysisError !== null &&
                    "requestId" in analysisError &&
                    typeof analysisError.requestId === "string"
                      ? analysisError.requestId
                      : null;
                  const message =
                    analysisError instanceof Error
                      ? analysisError.message
                      : "공고 분석에 실패했습니다.";
                  setError(requestId ? `${message} (요청번호: ${requestId})` : message);
                })
                .finally(() => setAnalyzing(false));
              return;
            }
            if (!form.title.trim()) {
              setError("제목을 입력해주세요.");
              return;
            }
            if (!form.deadline) {
              setError("마감일을 선택해주세요.");
              return;
            }
            setError(null);
            onSubmit({
              ...form,
              title: form.title.trim(),
              organization: form.organization.trim(),
              deadline: new Date(`${form.deadline}T23:59:00`).toISOString(),
            });
          }}
        >
          {step === 1 ? (
            <FormField
              label="공고 URL"
              htmlFor="program-source-url"
              labelVariant="muted"
              error={step === 1 ? error ?? undefined : undefined}
              required
            >
              <Input
                id="program-source-url"
                type="text"
                inputMode="url"
                className={inputClass}
                value={sourceUrl}
                placeholder="공고 링크를 붙여넣어주세요."
                autoFocus
                onChange={(event) => setSourceUrl(event.target.value)}
              />
            </FormField>
          ) : null}

          {step === 2 ? (
            <>
          <FormField
            label="제목"
            htmlFor="program-title"
            labelVariant="muted"
            required
          >
            <Input
              id="program-title"
              className={inputClass}
              value={form.title}
              placeholder="제목을 입력해주세요."
              onChange={(event) =>
                setForm((prev) => ({ ...prev, title: event.target.value }))
              }
            />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="기관명" htmlFor="program-org" labelVariant="muted">
              <Input
                id="program-org"
                className={inputClass}
                value={form.organization}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    organization: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="카테고리" htmlFor="program-category" labelVariant="muted">
              <Input
                id="program-category"
                className={inputClass}
                value={form.category}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, category: event.target.value }))
                }
              />
            </FormField>
            <FormField label="지역" htmlFor="program-region" labelVariant="muted">
              <Input
                id="program-region"
                className={inputClass}
                value={form.region}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, region: event.target.value }))
                }
              />
            </FormField>
            <FormField
              label="마감일"
              htmlFor="program-deadline"
              labelVariant="muted"
              required
            >
              <Input
                id="program-deadline"
                type="date"
                className={`${inputClass} appearance-none [&::-webkit-calendar-picker-indicator]:hidden ${form.deadline ? "text-ink" : "text-guide-text"}`}
                value={form.deadline}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, deadline: event.target.value }))
                }
              />
            </FormField>
          </div>
            </>
          ) : null}

          {error && step === 2 ? (
            <p role="alert" className="text-[13px] text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="mt-8 flex-row justify-end gap-0">
            {step === 2 && !program ? (
              <Button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep(1);
                }}
                className="h-11 rounded-[12px] bg-secondary-btn px-5 text-[15px] font-semibold text-secondary-btn-text shadow-none hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover"
              >
                이전
              </Button>
            ) : null}
            <Button
              type="submit"
              disabled={saving || analyzing || !canSubmit}
              className="h-11 rounded-[12px] bg-brand px-5 text-[15px] font-semibold text-brand-foreground shadow-none hover:bg-brand/88 active:bg-brand-pressed disabled:bg-brand-disabled disabled:opacity-100"
            >
              {step === 1
                ? analyzing
                  ? "분석 중…"
                  : "분석"
                : saving
                  ? "저장 중…"
                  : program
                    ? "저장하기"
                    : "추가하기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
