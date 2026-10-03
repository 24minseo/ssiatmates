import { useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Program, ScheduleInput } from "@/services/mockProgramService";

type ProgramScheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: Program | null;
  saving: boolean;
  onAdd: (input: ScheduleInput) => void;
  onToggle: (scheduleId: string) => void;
  onRemove: (scheduleId: string) => void;
};

function formatDate(value: string) {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}.${month}.${day}`;
}

export function ProgramScheduleDialog({
  open,
  onOpenChange,
  program,
  saving,
  onAdd,
  onToggle,
  onRemove,
}: ProgramScheduleDialogProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDate("");
  }, [open]);

  const inputClass =
    "h-11 rounded-[12px] border-field-border px-3.5 text-[15px] shadow-none placeholder:text-guide-text focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft";

  const schedules = [...(program?.schedules ?? [])].sort((a, b) =>
    a.scheduledAt.localeCompare(b.scheduledAt),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[520px] max-w-[calc(100vw-40px)] rounded-[20px] border-0 bg-surface p-8">
        <DialogHeader className="text-left">
          <DialogTitle className="pr-8 text-[20px] font-bold text-ink">
            {schedules.length > 0 ? "공고 일정 관리" : "공고 일정 추가하기"}
          </DialogTitle>
          <DialogDescription className="truncate text-[14px] text-ink-muted">
            {program?.title}
          </DialogDescription>
        </DialogHeader>

        <ul className="mt-2 max-h-[280px] space-y-2 overflow-y-auto">
          {schedules.length === 0 ? (
            <li className="rounded-[12px] bg-item-hover px-4 py-6 text-center text-[14px] text-ink-muted">
              연결된 일정이 없습니다.
            </li>
          ) : (
            schedules.map((schedule) => (
              <li
                key={schedule.id}
                className="flex items-center gap-3 rounded-[12px] border border-field-border px-4 py-3"
              >
                <button
                  type="button"
                  aria-label={
                    schedule.completed
                      ? `${schedule.title} 완료 취소`
                      : `${schedule.title} 완료 처리`
                  }
                  aria-pressed={schedule.completed}
                  onClick={() => onToggle(schedule.id)}
                  className={`flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    schedule.completed
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-field-border bg-surface"
                  }`}
                >
                  {schedule.completed ? <Check className="size-3.5" /> : null}
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[15px] ${
                      schedule.completed
                        ? "text-content-disabled line-through"
                        : "text-ink"
                    }`}
                  >
                    {schedule.title}
                  </p>
                  <p className="text-[13px] text-ink-muted">
                    {formatDate(schedule.scheduledAt)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`${schedule.title} 일정 삭제`}
                  onClick={() => onRemove(schedule.id)}
                  className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-icon-muted transition-colors hover:bg-item-hover hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))
          )}
        </ul>

        <form
          className="mt-4 space-y-3 border-t border-field-border pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (saving || !title.trim() || !date) return;
            onAdd({
              title: title.trim(),
              scheduledAt: new Date(`${date}T09:00:00`).toISOString(),
            });
            setTitle("");
            setDate("");
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
            <div className="space-y-1.5">
              <Label htmlFor="schedule-title" className="text-[14px] text-ink">
                일정 제목
              </Label>
              <Input
                id="schedule-title"
                className={inputClass}
                value={title}
                placeholder="예: 사업계획서 초안 작성"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schedule-date" className="text-[14px] text-ink">
                날짜
              </Label>
              <Input
                id="schedule-date"
                type="date"
                className={inputClass}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving || !title.trim() || !date}
              className="h-11 rounded-[12px] bg-brand px-5 text-[15px] font-semibold text-brand-foreground shadow-none hover:bg-brand/88 active:bg-brand-pressed disabled:bg-brand-disabled disabled:opacity-100"
            >
              {saving ? "추가 중…" : "일정 추가"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
