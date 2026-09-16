import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Program,
  ProgramInput,
  ProgramStatus,
} from "@/services/mockProgramService";

type ProgramFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: Program | null;
  saving: boolean;
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
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function ProgramFormDialog({
  open,
  onOpenChange,
  program,
  saving,
  onSubmit,
}: ProgramFormDialogProps) {
  const [form, setForm] = useState<ProgramInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[520px] max-w-[calc(100vw-40px)] rounded-[20px] border-0 bg-surface p-8">
        <DialogHeader className="text-left">
          <DialogTitle className="text-[20px] font-bold text-ink">
            {program ? "지원사업 수정" : "지원사업 추가"}
          </DialogTitle>
          <DialogDescription className="text-[14px] text-ink-muted">
            지원사업 정보를 입력해주세요.
          </DialogDescription>
        </DialogHeader>

        <form
          className="mt-2 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (saving) return;
            if (!form.title.trim()) {
              setError("지원사업명을 입력해주세요.");
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
          <div className="space-y-1.5">
            <Label htmlFor="program-title" className="text-[14px] text-ink">
              지원사업명
            </Label>
            <Input
              id="program-title"
              className={inputClass}
              value={form.title}
              placeholder="지원사업명을 입력해주세요."
              onChange={(event) =>
                setForm((prev) => ({ ...prev, title: event.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="program-org" className="text-[14px] text-ink">
                기관명
              </Label>
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="program-category" className="text-[14px] text-ink">
                카테고리
              </Label>
              <Input
                id="program-category"
                className={inputClass}
                value={form.category}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, category: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="program-stage" className="text-[14px] text-ink">
                창업단계
              </Label>
              <Input
                id="program-stage"
                className={inputClass}
                value={form.stage}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, stage: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="program-region" className="text-[14px] text-ink">
                지역
              </Label>
              <Input
                id="program-region"
                className={inputClass}
                value={form.region}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, region: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="program-deadline" className="text-[14px] text-ink">
                마감일
              </Label>
              <Input
                id="program-deadline"
                type="date"
                className={inputClass}
                value={form.deadline}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, deadline: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[14px] text-ink">상태</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    status: value as ProgramStatus,
                  }))
                }
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[12px]">
                  <SelectItem value="not_started">시작 전</SelectItem>
                  <SelectItem value="preparing">준비 중</SelectItem>
                  <SelectItem value="submitted">제출 완료</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-[13px] text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="mt-2 flex-row justify-end gap-2">
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-11 rounded-[12px] bg-secondary-btn px-5 text-[15px] font-semibold text-secondary-btn-text shadow-none hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-11 rounded-[12px] bg-brand px-5 text-[15px] font-semibold text-brand-foreground shadow-none hover:bg-brand/88 active:bg-brand-pressed disabled:bg-brand-disabled disabled:opacity-100"
            >
              {saving ? "저장 중…" : "저장하기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
