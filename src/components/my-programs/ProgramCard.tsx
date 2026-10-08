import { Fragment } from "react";
import { MoreVertical } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PROGRAM_STATUS_LABEL,
  type Program,
  type ProgramStatus,
} from "@/services/mockProgramService";

const statusPillClass: Record<ProgramStatus, string> = {
  not_started: "bg-[#f5f5f5] text-[#9a9d9b]",
  preparing: "bg-pill text-pill-foreground",
  submitted: "bg-menu-badge text-brand",
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getDeadlineLabel(
  deadline: string,
  presetLabel?: string | null,
  isClosed = false,
) {
  if (presetLabel) {
    const days = Number(presetLabel.replace("D-", ""));
    return {
      label: presetLabel,
      urgent: presetLabel === "D-DAY" || (!Number.isNaN(days) && days <= 7),
      expired: isClosed || presetLabel === "마감",
    };
  }

  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (target.getTime() - startOfToday().getTime()) / 86400000,
  );
  if (diff < 0) return { label: "마감", urgent: false, expired: true };
  if (diff === 0) return { label: "D-DAY", urgent: true, expired: false };
  return { label: `D-${diff}`, urgent: diff <= 7, expired: false };
}

export function getNextSchedule(program: Program) {
  return [...program.schedules]
    .filter((schedule) => !schedule.completed)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
}

function formatScheduleDate(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

type ProgramCardProps = {
  program: Program;
  onEdit: (program: Program) => void;
  onDelete: (program: Program) => void;
  onReportClick?: (program: Program) => void;
  onStatusChange: (program: Program, status: ProgramStatus) => void;
  onManageSchedules: (program: Program) => void;
};

export function ProgramCard({
  program,
  onDelete,
  onReportClick,
  onStatusChange,
  onManageSchedules,
}: ProgramCardProps) {
  const isSavedNotice = program.source === "saved";
  const canOpenReport = isSavedNotice && Boolean(onReportClick);
  const deadline = getDeadlineLabel(program.deadline, program.deadlineLabel, program.isClosed);
  const nextSchedule = getNextSchedule(program);
  const remaining = program.schedules.filter((s) => !s.completed).length;

  return (
    <article className="overflow-hidden rounded-[12px] bg-surface">
      <div className="flex h-[100px] flex-col rounded-tl-[12px] rounded-tr-[12px] border-l border-r border-t border-solid border-field-border px-6 py-6">
        <div className="grid h-8 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="w-fit min-w-0 max-w-full">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate break-keep text-[20px] font-semibold leading-6 text-ink">
              {program.url ? (
                <a href={program.url} target="_blank" rel="noreferrer" className="hover:underline hover:underline-offset-4">
                  {program.title}
                </a>
              ) : (
                program.title
              )}
            </h3>
            <span
              className={`inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-1.5 text-[12px] font-semibold leading-none ${
                deadline.urgent
                  ? "bg-deadline-surface text-deadline"
                  : deadline.expired
                    ? "bg-item-hover text-content-disabled"
                    : "bg-item-hover text-[#596963]"
              }`}
            >
              {deadline.label}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-[92px] shrink-0 items-center justify-end">
            <span
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold ${statusPillClass[program.status]}`}
            >
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {PROGRAM_STATUS_LABEL[program.status]}
            </span>
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`${program.title} 더보기 메뉴`}
                className="group/more flex size-8 cursor-pointer items-center justify-center rounded-[8px] text-icon-muted transition-colors hover:bg-item-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span aria-hidden className="flex size-6 flex-col items-center justify-center gap-[3px]"><span className="size-[2px] rounded-full bg-[#84968E] transition-colors group-hover/more:bg-ink" /><span className="size-[2px] rounded-full bg-[#84968E] transition-colors group-hover/more:bg-ink" /><span className="size-[2px] rounded-full bg-[#84968E] transition-colors group-hover/more:bg-ink" /></span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="status-actions-menu w-36 rounded-xl border-0 bg-surface p-1 shadow-none" style={{ boxShadow: "var(--shadow-dropdown)" }}>
              <DropdownMenuItem
                disabled={!canOpenReport}
                className="cursor-pointer px-[10px] text-ink hover:bg-dropdown-hover data-[highlighted]:bg-dropdown-hover focus:bg-dropdown-hover focus:text-ink"
                onSelect={() => {
                  if (canOpenReport) onReportClick?.(program);
                }}
              >
                리포트 보기
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-[10px] text-[12px] font-medium text-ink-muted">
                상태 변경
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={program.status}
                onValueChange={(value) =>
                  onStatusChange(program, value as ProgramStatus)
                }
              >
                {(["not_started", "preparing", "submitted"] as const).map((status) => (
                  <DropdownMenuRadioItem
                    key={status}
                    value={status}
                    className="pl-8 pr-[10px] text-[14px] text-ink hover:bg-dropdown-hover data-[state=checked]:bg-dropdown-hover data-[state=checked]:font-bold data-[state=checked]:text-ink data-[highlighted]:bg-dropdown-hover focus:bg-dropdown-hover"
                  >
                    {PROGRAM_STATUS_LABEL[status]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer px-[10px] text-destructive hover:bg-destructive-surface data-[highlighted]:bg-destructive-surface focus:bg-destructive-surface focus:text-destructive"
                onSelect={() => onDelete(program)}
              >
                {isSavedNotice ? "저장 해제" : "삭제하기"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
          <div className="mt-1 flex min-w-0 items-center text-[14px] font-normal text-ink-muted">
            {[program.organization, program.category, program.region]
              .filter(Boolean)
              .map((item, index) => (
                <Fragment key={item}>
                  {index > 0 ? (
                    <span
                      aria-hidden
                      className="mx-[6px] h-[10px] w-[1.5px] shrink-0 bg-field-border"
                    />
                  ) : null}
                  <span className="truncate">{item}</span>
                </Fragment>
              ))}
          </div>
      </div>
      <div className={`flex min-w-0 items-center gap-x-5 rounded-bl-[12px] rounded-br-[12px] border-b border-l border-r border-solid border-field-border bg-item-hover px-6 pr-[22px] ${program.schedules.length > 0 ? "h-[47px] py-[14px]" : "h-[46px] py-[13px]"}`}>
        <span className={`flex shrink-0 items-center gap-1 text-[14px] ${remaining > 0 ? "text-[#7a8883]" : "text-[#b4c1bd]"}`}>
          <img src={remaining > 0 ? "/assets/calendar-21-remaining.svg" : "/assets/calendar-21.svg"} alt="" aria-hidden className="size-[15px]" />
          {program.schedules.length > 0 ? `남은 일정 ${remaining}개` : "연결된 일정 없음"}
        </span>
        {nextSchedule ? (
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#596963]">
            다음 일정 · {formatScheduleDate(nextSchedule.scheduledAt)}{" "}
            {nextSchedule.title}
          </span>
        ) : null}
      </div>
    </article>
  );
}
