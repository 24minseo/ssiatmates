import { useEffect, useRef, useState, type DragEvent } from "react";
import { Check, Loader2, Upload, X } from "lucide-react";

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
import type { MatchedProgram } from "@/mocks/programSearchMock";

type ProgramFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: Program | null;
  saving: boolean;
  onAnalyze?: (inputUrl: string) => Promise<ManualNoticeAnalysisOutcome>;
  onSubmit: (input: ProgramInput, analysisResult?: ManualNoticeAnalysisResult | null, sourceUrl?: string) => void;
  manualProgram?: MatchedProgram | null;
  onUpdate?: (
    manualNoticeId: string,
    changes: Record<string, string | null>,
  ) => Promise<void> | void;
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

const MAX_UPLOAD_FILES = 1;
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

type LocalUpload = {
  id: string;
  file: File;
  status: "uploading" | "success" | "ready";
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getFileExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "파일";
}

function UploadNoticeIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" />
      <path
        d="M12 7.5V12.75"
        stroke="var(--surface)"
        strokeWidth="2.5"
        strokeLinecap="round"
        transform="rotate(180 12 12)"
      />
      <circle cx="12" cy="16.75" r="1.4" fill="var(--surface)" transform="rotate(180 12 12)" />
    </svg>
  );
}

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
  manualProgram = null,
  onUpdate,
}: ProgramFormDialogProps) {
  const [form, setForm] = useState<ProgramInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [sourceUrl, setSourceUrl] = useState("");
  const [localUploads, setLocalUploads] = useState<LocalUpload[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showUploadNotice, setShowUploadNotice] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ManualNoticeAnalysisResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStep(program || manualProgram ? 2 : 1);
    setSourceUrl("");
    setLocalUploads([]);
    setIsDraggingFiles(false);
    setFileError(null);
    setShowUploadNotice(true);
    setAnalyzing(false);
    setAnalysisResult(null);
    setForm(
      manualProgram
        ? {
            title: manualProgram.title,
            organization: manualProgram.organization,
            category: manualProgram.categories[0] ?? "",
            stage: "",
            region: manualProgram.categories[1] ?? "",
            status: "not_started",
            deadline: toDateInput(manualProgram.deadlineDate ?? ""),
          }
        : program
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
  }, [open, program, manualProgram]);

  const inputClass =
    "h-11 rounded-[12px] border-field-border px-3.5 text-[15px] shadow-none placeholder:text-guide-text focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft";
  const canSubmit =
    step === 1
      ? sourceUrl.trim().length > 0 && !analyzing
      : form.title.trim().length > 0 && (Boolean(manualProgram) || Boolean(form.deadline));

  const addLocalFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;

    const existingKeys = new Set(
      localUploads.map(({ file }) => `${file.name}:${file.size}:${file.lastModified}`),
    );
    const accepted: File[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      const extension = getFileExtension(file);
      if (extension === "zip") {
        rejected.push(`${file.name}은 압축 형식(zip)이라 추가할 수 없어요.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_SIZE) {
        rejected.push(`${file.name}은 20MB를 초과했어요.`);
        continue;
      }
      if (existingKeys.has(key)) continue;
      if (localUploads.length + accepted.length >= MAX_UPLOAD_FILES) {
        rejected.push(`파일은 최대 ${MAX_UPLOAD_FILES}개까지 추가할 수 있어요.`);
        break;
      }
      existingKeys.add(key);
      accepted.push(file);
    }

    setFileError(rejected[0] ?? null);
    if (!accepted.length) return;

    const uploads = accepted.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      status: "uploading" as const,
    }));
    setLocalUploads((current) => [...current, ...uploads]);
    window.setTimeout(() => {
      const ids = new Set(uploads.map(({ id }) => id));
      setLocalUploads((current) =>
        current.map((upload) =>
          ids.has(upload.id) ? { ...upload, status: "success" as const } : upload,
        ),
      );
      window.setTimeout(() => {
        setLocalUploads((current) =>
          current.map((upload) =>
            ids.has(upload.id) ? { ...upload, status: "ready" as const } : upload,
          ),
        );
      }, 500);
    }, 350);
  };

  const handleFileDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFiles(false);
    addLocalFiles(event.dataTransfer.files);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[600px] max-w-[calc(100vw-40px)] gap-0 rounded-[20px] border-0 bg-surface p-6"
        closeClassName="right-5 top-5 flex size-9 items-center justify-center rounded-lg text-ink-muted opacity-100 transition-colors hover:bg-item-hover hover:text-ink hover:opacity-100 focus:outline-none focus:ring-0 focus:ring-offset-0 [&_svg]:size-6"
      >
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-[20px] font-bold leading-7 text-ink">
            {manualProgram ? "수동 공고 수정" : program ? "지원사업 수정" : "수동 공고 추가"}
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
            if (!manualProgram && !form.deadline) {
              setError("마감일을 선택해주세요.");
              return;
            }
            setError(null);
            if (manualProgram) {
              if (!onUpdate) {
                setError("공고 수정 기능을 사용할 수 없습니다.");
                return;
              }
              void onUpdate(manualProgram.id, {
                title: form.title.trim(),
                organization: form.organization.trim() || null,
                field: form.category.trim() || null,
                region: form.region.trim() || null,
                deadline: form.deadline || null,
              });
              return;
            }
            onSubmit({
              ...form,
              title: form.title.trim(),
              organization: form.organization.trim(),
              deadline: new Date(`${form.deadline}T23:59:00`).toISOString(),
            }, analysisResult, sourceUrl.trim());
          }}
        >
          {step === 1 ? (
            <>
            {showUploadNotice ? (
              <div className="mb-4 flex h-11 items-center gap-1 rounded-[12px] bg-item-hover px-3 py-2 text-[14px] font-medium leading-5 text-ink-muted">
                <UploadNoticeIcon className="size-4 shrink-0 text-icon-muted" />
                <span className="min-w-0 flex-1 break-keep">
                  공고 URL과 원문 파일 중 하나 이상을 등록하면 분석할 수 있습니다.
                </span>
              </div>
            ) : null}
            <FormField
              label="공고 URL"
              htmlFor="program-source-url"
              labelVariant="default"
              labelClassName="text-[16px]"
              error={step === 1 ? error ?? undefined : undefined}
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

            <section className="mt-6" aria-labelledby="manual-file-upload-title">
              <div>
                <h3 id="manual-file-upload-title" className="text-[16px] font-semibold text-ink">
                  파일 업로드
                </h3>
                <ul className="mt-2 space-y-1 text-[14px] leading-5 text-ink-muted">
                  <li>• 압축 형식(zip) 파일을 제외한 모든 유형의 파일을 등록할 수 있습니다.</li>
                  <li>• 파일 1개당 크기는 20MB를 초과할 수 없으며, 최대 1개까지 등록할 수 있습니다.</li>
                </ul>
              </div>

              <div
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDraggingFiles(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  if (event.currentTarget === event.target) setIsDraggingFiles(false);
                }}
                onDrop={handleFileDrop}
                className={`mt-4 flex min-h-[142px] flex-col items-center justify-center rounded-[4px] border border-dashed px-5 py-6 text-center transition-colors ${isDraggingFiles ? "border-brand bg-brand/5" : "border-field-border bg-surface"}`}
              >
                <p className="text-[14px] text-ink-muted">
                  파일을 여기에 끌어다 놓거나, 파일 선택 버튼을 눌러주세요.
                </p>
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 h-10 rounded-[10px] border-0 bg-secondary-btn px-4 text-[14px] font-semibold text-secondary-btn-text shadow-none hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover"
                >
                  <Upload className="size-4" aria-hidden="true" />
                  파일 선택
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="*/*"
                  className="sr-only"
                  onChange={(event) => {
                    if (event.target.files) addLocalFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-[14px] font-semibold text-ink-muted">
                <span className="font-semibold">
                  <strong className="font-semibold text-brand">{localUploads.length}개</strong> / {MAX_UPLOAD_FILES}개
                </span>
              </div>

              {fileError ? (
                <p role="alert" className="mt-2 text-[13px] text-destructive">
                  {fileError}
                </p>
              ) : null}

              {localUploads.length ? (
                <ul className="mt-2 space-y-2" aria-label="추가한 파일 목록">
                  {localUploads.map((upload) => (
                    <li
                      key={upload.id}
                      className="flex items-center gap-3 rounded-[10px] border border-field-border bg-surface px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{upload.file.name}</p>
                        <p className="mt-0.5 text-[12px] text-ink-muted">
                          {getFileExtension(upload.file).toUpperCase()} · {formatFileSize(upload.file.size)}
                        </p>
                      </div>
                      {upload.status === "uploading" ? (
                        <span
                          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#F1F3F2]"
                          aria-label="파일 확인 중"
                        >
                          <Loader2 className="size-3.5 animate-spin text-[#2F80ED]" aria-hidden="true" />
                        </span>
                      ) : upload.status === "success" ? (
                        <span
                          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#F2F7F4] text-brand"
                          aria-label="파일 추가 완료"
                        >
                          <Check className="size-3.5 animate-upload-status-pop-in stroke-[3]" aria-hidden="true" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          aria-label={`${upload.file.name} 삭제`}
                          onClick={() =>
                            setLocalUploads((current) => current.filter((item) => item.id !== upload.id))
                          }
                          className="relative flex size-5 shrink-0 items-center justify-center rounded-full bg-[#E5E8E7] text-[#25332E] opacity-70 transition-[background-color,opacity] hover:bg-[#D9DEDC] hover:opacity-100"
                        >
                          <span className="absolute inset-0 flex items-center justify-center animate-upload-status-pop-out">
                            <Check className="size-3.5 stroke-[3]" aria-hidden="true" />
                          </span>
                          <span className="absolute inset-0 flex items-center justify-center animate-upload-status-x-in">
                            <X className="size-3.5 stroke-[2.5]" aria-hidden="true" />
                          </span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
            </>
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
            {manualProgram ? (
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="h-11 rounded-[12px] bg-secondary-btn px-5 text-[15px] font-semibold text-secondary-btn-text shadow-none hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover"
              >
                취소
              </Button>
            ) : step === 2 && !program ? (
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
                  : program || manualProgram
                    ? "저장하기"
                    : "추가하기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
