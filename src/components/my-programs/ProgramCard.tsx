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

export function getDeadlineLabel(deadline: string) {
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (target.getTime() - startOfToday().getTime()) / 86400000,
  );
  if (diff < 0) return { label: "마감", urgent: false };
  if (diff === 0) return { label: "D-DAY", urgent: true };
  return { label: `D-${diff}`, urgent: diff <= 7 };
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
  onStatusChange: (program: Program, status: ProgramStatus) => void;
  onManageSchedules: (program: Program) => void;
};

export function ProgramCard({
  program,
  onDelete,
  onStatusChange,
  onManageSchedules,
}: ProgramCardProps) {
  const deadline = getDeadlineLabel(program.deadline);
  const nextSchedule = getNextSchedule(program);
  const remaining = program.schedules.filter((s) => !s.completed).length;

  return (
    <article className="overflow-hidden rounded-[12px] bg-surface">
      <div className="grid h-[100px] grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-tl-[12px] rounded-tr-[12px] border-l border-r border-t border-solid border-field-border pl-6 pr-4 py-6">
        <div className="min-w-0 w-fit max-w-[1038px]">
          <div className="flex min-w-0 items-center gap-4">
            <h3 className="min-w-0 flex-1 truncate break-keep text-[20px] font-semibold leading-6 text-ink">
              {program.title}
            </h3>
            <span
              className={`shrink-0 rounded-[6px] px-1.5 py-0.5 text-[12px] font-semibold ${
                deadline.urgent
                  ? "bg-destructive/10 text-destructive"
                  : "bg-item-hover text-content-disabled"
              }`}
            >
              {deadline.label}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 items-center text-[14px] font-normal text-ink-muted">
            {[program.organization, program.category, program.stage, program.region]
              .filter(Boolean)
              .map((item, index) => (
                <Fragment key={item}>
                  {index > 0 ? (
                    <span
                      aria-hidden
                      className="mx-2 h-[8px] w-[1.2px] shrink-0 bg-field-border"
                    />
                  ) : null}
                  <span className="truncate">{item}</span>
                </Fragment>
              ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold ${statusPillClass[program.status]}`}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {PROGRAM_STATUS_LABEL[program.status]}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`${program.title} 더보기 메뉴`}
                className="group/more flex size-8 items-center justify-center rounded-[8px] text-icon-muted transition-colors hover:bg-item-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span aria-hidden className="flex size-6 flex-col items-center justify-center gap-[3px]"><span className="size-[2px] rounded-full bg-[#84968E] transition-colors group-hover/more:bg-ink" /><span className="size-[2px] rounded-full bg-[#84968E] transition-colors group-hover/more:bg-ink" /><span className="size-[2px] rounded-full bg-[#84968E] transition-colors group-hover/more:bg-ink" /></span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>상태 변경</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={program.status}
                onValueChange={(value) =>
                  onStatusChange(program, value as ProgramStatus)
                }
              >
                <DropdownMenuRadioItem value="not_started">
                  시작 전
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="preparing">
                  준비 중
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="submitted">
                  제출 완료
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onDelete(program)}
              >
                삭제하기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        <button
          type="button"
          onClick={() => onManageSchedules(program)}
          className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-[8px] px-1 text-[14px] font-medium text-[#9a9d9b] transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {remaining > 0 || program.schedules.length > 0
            ? "일정 관리하기"
            : "일정 추가하기"}
          <img src="/assets/chevron-right-17.svg" alt="" aria-hidden className="size-[18px]" />
        </button>
      </div>
    </article>
  );
}
