import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LayeredTextarea } from "@/components/ui/layered-textarea";
import { TimeWheelPicker } from "@/components/ui/time-wheel-picker";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { createCalendarTask } from "@/services/calendarTaskApi";
import { mutateCalendarEvent } from "@/services/calendarEventMutationApi";
import { getCalendarEvents } from "@/services/calendarEventsApi";
import { normalizeCalendarEvents } from "@/services/calendarEventModel";
import { savedNoticesApi, type SavedNotice } from "@/services/savedNoticesApi";

export const Route = createFileRoute("/calendar/")({
  head: () => ({
    links: [
      {
        rel: "preload",
        href: "/assets/badge/close-20.svg",
        as: "image",
        type: "image/svg+xml",
      },
    ],
    meta: [
      { title: "전체 캘린더" },
      {
        name: "description",
        content: "지원사업 일정과 할 일을 월별 또는 공고별로 관리하는 SSIAT 전체 캘린더입니다.",
      },
      { property: "og:title", content: "전체 캘린더" },
      {
        property: "og:description",
        content: "지원사업 일정과 할 일을 한눈에 확인하고 관리하세요.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});

type CalendarView = "month" | "notice";
type DateSelectionMode = "single" | "range";
type ContentMode = "memo" | "checklist";

type ChecklistItem = {
  id: number;
  text: string;
  completed: boolean;
};

type ChecklistDropPosition = "before" | "after";

const REMINDER_MAX_ITEMS = 4;
const REMINDER_QUICK_OPTIONS = [
  { label: "10분 전", minutes: 10 },
  { label: "1시간 전", minutes: 60 },
  { label: "1일 전", minutes: 1440 },
] as const;
const REMINDER_DATE_ONLY_OPTIONS = [
  { label: "1일 전", minutes: 1440 },
  { label: "3일 전", minutes: 4320 },
  { label: "7일 전", minutes: 10080 },
] as const;
const REMINDER_UNITS = [
  { label: "분", minutes: 1 },
  { label: "시간", minutes: 60 },
  { label: "일", minutes: 1440 },
] as const;

type ReminderUnit = (typeof REMINDER_UNITS)[number]["label"];

type CalendarEvent = {
  id: number | string;
  title: string;
  date: string;
  endDate?: string;
  description: string;
  contentMode?: ContentMode;
  checklistItems?: ChecklistItem[];
  startTime?: string;
  reminders?: string[];
  color?: string;
  url?: string;
  allDay?: boolean;
  dateMode?: DateSelectionMode;
  savedNoticeId?: string | null;
  linkedNotice?: Record<string, unknown> | null;
  updatedAt?: string | null;
  completed?: boolean;
};

const EVENT_COLORS = [
  { label: "초록", value: "#1F8064", dotColor: "#83C9AF" },
  { label: "빨강", value: "#E54740", dotColor: "#E78B94" },
  { label: "파랑", value: "#3568B8", dotColor: "#8BADE4" },
  { label: "보라", value: "#7150A8", dotColor: "#A98BD3" },
  { label: "회색", value: "", dotColor: "#D7E5E0" },
] as const;
const UNSELECTED_PROGRAM_HOVER_ID = "__unselected_program__";

type CalendarDay = {
  date: Date;
  key: string;
  isCurrentMonth: boolean;
};

const KOREAN_INITIALS = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ",
  "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

function getKoreanInitials(value: string) {
  return Array.from(value)
    .map((character) => {
      const code = character.charCodeAt(0);
      if (code < 0xac00 || code > 0xd7a3) return character;
      return KOREAN_INITIALS[Math.floor((code - 0xac00) / 588)] ?? character;
    })
    .join("");
}

function isKoreanConsonant(value: string) {
  const code = value.charCodeAt(0);
  return code >= 0x3131 && code <= 0x314e;
}

function matchesKoreanQuery(text: string, query: string) {
  const characters = Array.from(text.toLowerCase());
  const queryCharacters = Array.from(query.trim().toLowerCase());

  return characters.some((_, startIndex) =>
    queryCharacters.every((queryCharacter, offset) => {
      const textCharacter = characters[startIndex + offset];
      if (!textCharacter) return false;
      return isKoreanConsonant(queryCharacter)
        ? getKoreanInitials(textCharacter) === queryCharacter
        : textCharacter === queryCharacter;
    }),
  );
}

function matchesSavedProgram(program: SavedNotice, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  const text = `${program.title} ${program.organization}`.toLowerCase();
  const initials = getKoreanInitials(text);
  return (
    text.includes(normalizedQuery) ||
    initials.includes(normalizedQuery) ||
    matchesKoreanQuery(text, normalizedQuery)
  );
}

type CalendarPeriodSegment = {
  event: CalendarEvent;
  weekIndex: number;
  startColumn: number;
  span: number;
  lane: number;
  isStart: boolean;
  isEnd: boolean;
};

const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"] as const;
const CHECKLIST_MAX_ITEMS = 10;
const CHECKLIST_ITEM_MAX_LENGTH = 80;

function resizeChecklistTextarea(element: HTMLTextAreaElement) {
  element.style.height = "32px";
  element.style.height = `${Math.min(element.scrollHeight, 64)}px`;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatKoreanDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}

function getSoftEventColor(color?: string, alpha = "12") {
  if (color === "#79A0D8") color = "#3568B8";
  if (color === "#1F8064") {
    return alpha === "20"
      ? "color-mix(in srgb, var(--event-support-surface) 82%, var(--brand) 18%)"
      : "var(--event-support-surface)";
  }
  if (color === "var(--deadline)") {
    return alpha === "20"
      ? "color-mix(in srgb, var(--deadline-surface) 82%, var(--deadline) 18%)"
      : "var(--deadline-surface)";
  }
  if (color?.startsWith("oklch(")) {
    const percentage = alpha === "20" ? 12 : 7;
    return `color-mix(in srgb, ${color} ${percentage}%, transparent)`;
  }
  return color ? `${color}${alpha}` : undefined;
}

function getEventForegroundColor(color?: string) {
  const legacyColorMap: Record<string, string> = {
    "#D9828B": "var(--deadline)",
    "#C53B45": "var(--deadline)",
    "#69B39A": "#1F8064",
    "#79A0D8": "#3568B8",
    "#9A7BC5": "#7150A8",
  };
  return color ? legacyColorMap[color] ?? color : undefined;
}

function formatTimeLabel(time?: string) {
  if (!time) return "";
  const [hours = NaN, minutes = NaN] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  const period = hours < 12 ? "오전" : "오후";
  const displayHours = hours % 12 || 12;
  return `${period} ${displayHours}:${String(minutes).padStart(2, "0")}`;
}

function getEventDurationDays(event: CalendarEvent) {
  const start = new Date(`${event.date}T00:00:00`);
  const end = new Date(`${event.endDate ?? event.date}T00:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}


function buildCalendarPeriodSegments(events: CalendarEvent[], days: CalendarDay[]): CalendarPeriodSegment[] {
  const segments: CalendarPeriodSegment[] = [];
  const weekCount = days.length / 7;

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const weekDays = days.slice(weekIndex * 7, weekIndex * 7 + 7);
    const weekStart = weekDays[0]!.key;
    const weekEnd = weekDays[6]!.key;
    const lanes: Array<Array<{ start: number; end: number }>> = [];
    const weekEvents = events
      .filter((event) => {
        const endDate = event.endDate ?? event.date;
        return endDate > event.date && event.date <= weekEnd && endDate >= weekStart;
      })
      .sort(
        (a, b) =>
          getEventDurationDays(b) - getEventDurationDays(a) ||
          a.date.localeCompare(b.date) ||
          a.id - b.id,
      );

    for (const event of weekEvents) {
      const endDate = event.endDate ?? event.date;
      const segmentStart = event.date > weekStart ? event.date : weekStart;
      const segmentEnd = endDate < weekEnd ? endDate : weekEnd;
      const startColumn = weekDays.findIndex((day) => day.key === segmentStart);
      const endColumn = weekDays.findIndex((day) => day.key === segmentEnd);
      if (startColumn === -1 || endColumn === -1) continue;

      const lane = lanes.findIndex((intervals) =>
        intervals.every(
          (interval) => endColumn < interval.start || startColumn > interval.end,
        ),
      );
      if (lane === -1) {
        lanes.push([{ start: startColumn, end: endColumn }]);
      } else {
        lanes[lane]!.push({ start: startColumn, end: endColumn });
      }

      segments.push({
        event,
        weekIndex,
        startColumn,
        span: endColumn - startColumn + 1,
        lane: lane === -1 ? lanes.length - 1 : lane,
        isStart: event.date === segmentStart,
        isEnd: endDate === segmentEnd,
      });
    }
  }

  return segments;
}

function buildCalendarDays(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekCount = Math.ceil((firstDay.getDay() + daysInMonth) / 7);
  const firstVisibleDate = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: weekCount * 7 }, (_, index) => {
    const date = new Date(
      firstVisibleDate.getFullYear(),
      firstVisibleDate.getMonth(),
      firstVisibleDate.getDate() + index,
    );
    return {
      date,
      key: toDateKey(date),
      isCurrentMonth: date.getMonth() === month && date.getFullYear() === year,
    };
  });
}


type DateRangePickerProps = {
  mode: DateSelectionMode;
  startDate: string;
  endDate: string;
  initialMode: DateSelectionMode;
  initialStartDate: string;
  initialEndDate: string;
  onModeChange: (mode: DateSelectionMode) => void;
  onChange: (startDate: string, endDate?: string) => void;
};

function DateRangePicker({
  mode,
  startDate,
  endDate,
  initialMode,
  initialStartDate,
  initialEndDate,
  onModeChange,
  onChange,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const base = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [isDragging, setIsDragging] = useState(false);
  const [monthTransition, setMonthTransition] = useState<{
    from: Date;
    to: Date;
    direction: "next" | "previous";
    phase: "start" | "end";
  } | null>(null);
  const dragMovedRef = useRef(false);
  const monthTransitionTimeoutRef = useRef<number | null>(null);
  const monthTransitionRafRef = useRef<number | null>(null);

  const syncDraft = () => {
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setMonthTransition(null);
    const base = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
    setVisibleMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  };

  useEffect(() => {
    return () => {
      if (monthTransitionTimeoutRef.current !== null) {
        window.clearTimeout(monthTransitionTimeoutRef.current);
      }
      if (monthTransitionRafRef.current !== null) {
        window.cancelAnimationFrame(monthTransitionRafRef.current);
      }
    };
  }, []);

  const closePicker = () => {
    setIsDragging(false);
    setOpen(false);
  };

  const movePickerMonth = (offset: number) => {
    const direction = offset > 0 ? "next" : "previous";
    const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    setMonthTransition({ from: visibleMonth, to: nextMonth, direction, phase: "start" });
    setVisibleMonth(nextMonth);
    if (monthTransitionTimeoutRef.current !== null) {
      window.clearTimeout(monthTransitionTimeoutRef.current);
    }
    if (monthTransitionRafRef.current !== null) {
      window.cancelAnimationFrame(monthTransitionRafRef.current);
    }
    monthTransitionRafRef.current = window.requestAnimationFrame(() => {
      setMonthTransition((current) =>
        current?.to.getTime() === nextMonth.getTime()
          ? { ...current, phase: "end" }
          : current,
      );
      monthTransitionRafRef.current = null;
    });
    monthTransitionTimeoutRef.current = window.setTimeout(() => {
      setMonthTransition(null);
      monthTransitionTimeoutRef.current = null;
    }, 220);
  };

  const commitRange = (candidateEnd: string) => {
    if (!draftStart) return;
    const sorted = [draftStart, candidateEnd].sort();
    const start = sorted[0] ?? draftStart;
    const end = sorted[1] ?? candidateEnd;
    setDraftStart(start);
    setDraftEnd(end);
    onChange(start, end === start ? undefined : end);
    closePicker();
  };

  const handleDayPointerDown = (dayKey: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (mode !== "range") return;
    event.preventDefault();
    dragMovedRef.current = false;
    if (!draftStart || draftEnd) {
      setDraftStart(dayKey);
      setDraftEnd("");
    }
    setIsDragging(true);
  };

  const handleDayPointerEnter = (dayKey: string) => {
    if (mode !== "range" || !isDragging || !draftStart) return;
    if (dayKey !== draftStart) dragMovedRef.current = true;
    setDraftEnd(dayKey);
  };

  const handleDayPointerUp = (dayKey: string) => {
    if (mode !== "range" || !isDragging) return;
    setIsDragging(false);
    if (dragMovedRef.current && draftStart) {
      commitRange(dayKey);
    }
  };

  const handleDayClick = (dayKey: string) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    if (mode === "single") {
      setDraftStart(dayKey);
      setDraftEnd("");
      onChange(dayKey);
      closePicker();
      return;
    }
    if (!draftStart || draftEnd) {
      setDraftStart(dayKey);
      setDraftEnd("");
      return;
    }
    if (draftStart !== dayKey) commitRange(dayKey);
  };

  const displayValue =
    mode === "range" && startDate && endDate
      ? `${formatDateLabel(startDate)} ~ ${formatDateLabel(endDate)}`
      : startDate
        ? formatDateLabel(startDate)
        : "날짜 선택";

  const rangeStart = draftStart && draftEnd ? [draftStart, draftEnd].sort()[0] : draftStart;
  const rangeEnd = draftStart && draftEnd ? [draftStart, draftEnd].sort()[1] : draftEnd;

  const renderCalendarDays = (monthDate: Date) => {
    const monthDays = buildCalendarDays(monthDate.getFullYear(), monthDate.getMonth());
    return monthDays.map((day, index) => {
      const selectedStart = rangeStart === day.key;
      const selectedEnd = rangeEnd === day.key;
      const isEndpoint = selectedStart || selectedEnd;
      const hasRange = Boolean(mode === "range" && rangeStart && rangeEnd);
      const inRange =
        hasRange &&
        day.key >= rangeStart! &&
        day.key <= rangeEnd!;
      const startsRowSegment = inRange && (selectedStart || index % 7 === 0);
      const endsRowSegment = inRange && (selectedEnd || index % 7 === 6);

      return (
        <div
          key={day.key}
          className={cn(
            "relative flex h-10 items-center justify-center",
            inRange &&
              "before:absolute before:top-1 before:h-8 before:bg-pill before:content-['']",
            inRange && (selectedStart ? "before:left-1" : "before:left-0"),
            inRange && (selectedEnd ? "before:right-1" : "before:right-0"),
            startsRowSegment && "before:rounded-l-[10px]",
            endsRowSegment && "before:rounded-r-[10px]",
          )}
        >
          <button
            type="button"
            onPointerDown={(event) => handleDayPointerDown(day.key, event)}
            onPointerEnter={() => handleDayPointerEnter(day.key)}
            onPointerUp={() => handleDayPointerUp(day.key)}
            onClick={() => handleDayClick(day.key)}
            className={cn(
              "group relative z-10 flex size-10 items-center justify-center rounded-[10px] text-[14px] font-normal",
              !day.isCurrentMonth && !isEndpoint && "text-content-disabled",
              day.isCurrentMonth && !inRange && !isEndpoint && "text-ink-muted",
              inRange && !isEndpoint && "text-ink-muted",
              isEndpoint && "text-white",
            )}
          >
            <span
              className={cn(
                "flex items-center justify-center transition-colors",
                day.isCurrentMonth &&
                  !inRange &&
                  !isEndpoint &&
                  "size-8 rounded-[8px] group-hover:bg-pill",
                isEndpoint &&
                  "size-8 rounded-[8px] bg-brand text-white",
              )}
            >
              {day.date.getDate()}
            </span>
          </button>
        </div>
      );
    });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) syncDraft();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-12 w-full items-center justify-between rounded-[12px] border border-field-border bg-surface px-3.5 text-left text-[15px] text-ink shadow-none transition-colors hover:bg-item-hover focus-visible:border-brand focus-visible:outline-none focus-visible:ring-[3.2px] focus-visible:ring-focus-soft"
          aria-label={mode === "range" ? "기간 날짜 선택" : "날짜 선택"}
        >
          <span className={startDate ? "text-ink" : "text-guide-text"}>{displayValue}</span>
          <img
            src="/assets/calendar/21.svg"
            alt=""
            aria-hidden="true"
            className="size-5 object-contain"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[304px] max-w-[calc(100vw-24px)] rounded-[16px] border-0 bg-surface p-3 shadow-dropdown"
      >
        <div
          role="tablist"
          aria-label="일정 기간 유형"
          className="relative flex border-b border-field-border"
        >
          {(["single", "range"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={mode === option}
              onClick={() => {
                onModeChange(option);
                if (option === "single") {
                  setDraftEnd("");
                  onChange(draftStart || startDate, undefined);
                }
              }}
              className={cn(
                "relative z-10 flex h-[38px] flex-1 items-center justify-center px-3 text-[14px] font-medium transition-colors",
                mode === option
                  ? "font-semibold text-brand"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {option === "single" ? "하루 일정" : "기간 일정"}
            </button>
          ))}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-px left-0 z-20 h-0.5 w-1/2 bg-brand transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(${mode === "range" ? 100 : 0}%)` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between px-1">
          <span className="text-left text-[15px] font-semibold text-ink">
            {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="이전 달"
              onClick={() => movePickerMonth(-1)}
              className="size-8 rounded-[8px] text-ink-muted hover:bg-item-hover hover:text-ink"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="다음 달"
              onClick={() => movePickerMonth(1)}
              className="size-8 rounded-[8px] text-ink-muted hover:bg-item-hover hover:text-ink"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-7 text-center text-[13px] font-medium text-ink">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
            <span key={day} className="flex h-8 items-center justify-center">{day}</span>
          ))}
        </div>
        <div className="overflow-hidden">
          <div
            className={cn(
              "flex",
              monthTransition && "transition-transform duration-200 ease-in-out motion-reduce:transition-none",
              monthTransition ? "w-[200%]" : "w-full",
            )}
            style={
              monthTransition
                ? {
                    transform:
                      monthTransition.phase === "start"
                        ? monthTransition.direction === "next"
                          ? "translateX(0)"
                          : "translateX(-50%)"
                        : monthTransition.direction === "next"
                          ? "translateX(-50%)"
                          : "translateX(0)",
                  }
                : undefined
            }
          >
            {(monthTransition
              ? monthTransition.direction === "next"
                ? [monthTransition.from, monthTransition.to]
                : [monthTransition.to, monthTransition.from]
              : [visibleMonth]
            ).map((monthDate) => (
              <div
                key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
                className={cn(
                  "shrink-0",
                  monthTransition ? "w-1/2" : "w-full",
                )}
              >
                <div className="grid grid-cols-7">
                  {renderCalendarDays(monthDate)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between border-t border-field-border px-1 pt-2.5">
          <button
            type="button"
            onClick={() => {
              setDraftStart(initialStartDate);
              setDraftEnd(initialEndDate);
              onModeChange(initialMode);
              onChange(initialStartDate, initialEndDate || undefined);
              closePicker();
            }}
            className="inline-flex h-8 items-center gap-1 px-1 text-[13px] text-ink-muted hover:text-ink hover:underline hover:underline-offset-2"
          >
            <RotateCcw aria-hidden className="size-3.5" strokeWidth={2} />
            초기화
          </button>
          <button
            type="button"
            onClick={() => {
              const current = toDateKey(new Date());
              setVisibleMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
              if (mode === "single") {
                onChange(current);
                closePicker();
              } else {
                setDraftStart(current);
                setDraftEnd("");
              }
            }}
            className="h-8 px-1 text-[13px] font-semibold text-brand hover:underline hover:underline-offset-2"
          >
            오늘
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type MonthFieldProps = {
  value: Date;
  onChange: (value: Date) => void;
};

function MonthField({ value, onChange }: MonthFieldProps) {
  const year = value.getFullYear();
  const month = value.getMonth();
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(month + 1).padStart(2, "0"));
  const [inputError, setInputError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const originRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!isEditing) return;
    const parsedMonth = Number(inputValue);
    const isValid =
      /^\d{1,2}$/.test(inputValue) &&
      Number.isInteger(parsedMonth) &&
      parsedMonth >= 1 &&
      parsedMonth <= 12;
    if (!isValid) return;

    const timeout = window.setTimeout(() => {
      onChange(new Date(year, parsedMonth - 1, 1));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [inputValue, isEditing, onChange, year]);

  useEffect(() => {
    if (!isEditing) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isEditing]);

  const beginEditing = () => {
    originRef.current = new Date(year, month, 1);
    setInputValue(String(month + 1).padStart(2, "0"));
    setInputError(false);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    const origin = originRef.current;
    if (origin) {
      onChange(origin);
      setInputValue(String(origin.getMonth() + 1).padStart(2, "0"));
    }
    originRef.current = null;
    setInputError(false);
    setIsEditing(false);
  };

  const commitEditing = () => {
    if (inputValue === "") {
      cancelEditing();
      return true;
    }

    const parsedMonth = Number(inputValue);
    const isValid =
      /^\d{1,2}$/.test(inputValue) &&
      Number.isInteger(parsedMonth) &&
      parsedMonth >= 1 &&
      parsedMonth <= 12;
    if (!isValid) {
      setInputError(true);
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return false;
    }

    onChange(new Date(year, parsedMonth - 1, 1));
    setInputValue(String(parsedMonth).padStart(2, "0"));
    originRef.current = null;
    setInputError(false);
    setIsEditing(false);
    return true;
  };

  return (
    <div
      className={cn(
        "relative h-[42px] shrink-0 transition-[width] duration-100 ease-out will-change-[width] motion-reduce:transition-none",
        isEditing ? "w-[132px]" : "w-[116px]",
      )}
    >
      <div
        aria-hidden={!isEditing}
        className={cn(
          "absolute inset-0 flex h-full w-full items-center whitespace-nowrap rounded-[12px] border bg-surface px-4 text-[15px] font-semibold text-ink ring-[3.2px]",
          inputError
            ? "border-destructive ring-destructive/20"
            : "border-brand ring-focus-soft",
          isEditing
            ? "opacity-100"
            : "pointer-events-none opacity-0",
        )}
      >
        <div className="flex min-w-0 items-center gap-1">
          <span className="shrink-0">{year}년</span>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            role="spinbutton"
            tabIndex={isEditing ? 0 : -1}
            value={inputValue}
            aria-label="이동할 월"
            aria-valuemin={1}
            aria-valuemax={12}
            aria-valuenow={
              Number(inputValue) >= 1 && Number(inputValue) <= 12
                ? Number(inputValue)
                : undefined
            }
            aria-invalid={inputError}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              const nextValue = event.target.value.replace(/\D/g, "").slice(0, 2);
              setInputValue(nextValue);
              const parsedMonth = Number(nextValue);
              if (
                nextValue === "" ||
                (/^\d{1,2}$/.test(nextValue) && parsedMonth >= 1 && parsedMonth <= 12)
              ) {
                setInputError(false);
              }
            }}
            onBlur={commitEditing}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                const currentMonth = Number(inputValue);
                const baseMonth =
                  Number.isInteger(currentMonth) && currentMonth >= 1 && currentMonth <= 12
                    ? currentMonth
                    : month + 1;
                const nextMonth =
                  event.key === "ArrowUp"
                    ? Math.min(12, baseMonth + 1)
                    : Math.max(1, baseMonth - 1);
                setInputValue(String(nextMonth).padStart(2, "0"));
                setInputError(false);
                onChange(new Date(year, nextMonth - 1, 1));
                window.requestAnimationFrame(() => inputRef.current?.select());
              } else if (event.key === "Enter") {
                event.preventDefault();
                commitEditing();
              } else if (event.key === "Escape") {
                event.preventDefault();
                cancelEditing();
              }
            }}
            className={cn(
              "h-7 w-7 rounded-[4px] border-0 bg-focus-soft px-0 text-center text-[15px] font-semibold outline-none ring-0 selection:bg-transparent selection:text-inherit focus:ring-0",
              inputError ? "text-destructive" : "text-ink",
            )}
          />
          <span className="shrink-0">월</span>
        </div>
      </div>
      <button
        type="button"
        onClick={beginEditing}
        aria-label={`${year}년 ${month + 1}월, 월 직접 입력`}
        tabIndex={isEditing ? -1 : 0}
        className={cn(
          "absolute inset-0 flex h-full w-full items-center whitespace-nowrap rounded-[12px] border border-field-border bg-surface px-4 text-[15px] font-semibold text-ink hover:bg-item-hover focus-visible:border-brand focus-visible:outline-none focus-visible:ring-[3.2px] focus-visible:ring-focus-soft",
          isEditing
            ? "pointer-events-none opacity-0"
            : "opacity-100",
        )}
      >
        {year}년 {String(month + 1).padStart(2, "0")}월
      </button>
    </div>
  );
}


function CalendarPage() {
  const { loading: authLoading, session, user } = useAuth();
  const createCalendarTaskFn = useServerFn(createCalendarTask);
  const mutateCalendarEventFn = useServerFn(mutateCalendarEvent);
  const getCalendarEventsFn = useServerFn(getCalendarEvents);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const eventsRequestRef = useRef<Promise<void> | null>(null);
  const eventsGenerationRef = useRef(0);
  const ownerIdRef = useRef<string | null>(null);
  ownerIdRef.current = user?.id ?? null;
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: string; events: CalendarEvent[] } | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventColor, setEventColor] = useState<string>(EVENT_COLORS[0].value);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [programPickerOpen, setProgramPickerOpen] = useState(false);
  const [savedPrograms, setSavedPrograms] = useState<SavedNotice[]>([]);
  const [savedProgramsLoading, setSavedProgramsLoading] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<SavedNotice | null>(null);
  const [programSearch, setProgramSearch] = useState("");
  const [hoveredProgramId, setHoveredProgramId] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [dateSelectionMode, setDateSelectionMode] = useState<DateSelectionMode>("single");
  const [initialDateSelection, setInitialDateSelection] = useState<{
    mode: DateSelectionMode;
    startDate: string;
    endDate: string;
  }>({
    mode: "single",
    startDate: "",
    endDate: "",
  });
  const [calendarDragStart, setCalendarDragStart] = useState<string | null>(null);
  const [calendarDragEnd, setCalendarDragEnd] = useState<string | null>(null);
  const calendarDragMovedRef = useRef(false);
  const calendarAddOriginRef = useRef<"toolbar" | "calendar">("toolbar");
  const [eventDescription, setEventDescription] = useState("");
  const [contentMode, setContentMode] = useState<ContentMode>("memo");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [focusedChecklistId, setFocusedChecklistId] = useState<number | null>(null);
  const [draggingChecklistId, setDraggingChecklistId] = useState<number | null>(null);
  const [dragOverChecklistId, setDragOverChecklistId] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<ChecklistDropPosition>("before");
  const [checklistHandleTop, setChecklistHandleTop] = useState<number | null>(null);
  const [checklistHandleMotionEnabled, setChecklistHandleMotionEnabled] = useState(false);
  const [checklistHandleVisible, setChecklistHandleVisible] = useState(false);
  const [checklistGhostTop, setChecklistGhostTop] = useState<number | null>(null);
  const [eventStartTime, setEventStartTime] = useState("");
  const [reminders, setReminders] = useState<string[]>([]);
  const [reminderPickerOpen, setReminderPickerOpen] = useState(false);
  const [reminderPickerMode, setReminderPickerMode] = useState<"quick" | "custom">("quick");
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [customReminderAmount, setCustomReminderAmount] = useState("");
  const [customReminderUnit, setCustomReminderUnit] = useState<ReminderUnit>("분");
  const [reminderError, setReminderError] = useState("");
  const [reminderUnitHintOpen, setReminderUnitHintOpen] = useState(false);
  const [reminderUnitHintSeen, setReminderUnitHintSeen] = useState(false);

  useEffect(() => {
    eventsGenerationRef.current += 1;
    eventsRequestRef.current = null;
    setEvents([]);
    setSelectedEvent(null);
  }, [user?.id]);

  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);

  const getFreshAccessToken = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    let currentSession = data.session;
    if (!currentSession) return null;

    const expiresAt = (currentSession.expires_at ?? 0) * 1000;
    if (expiresAt > 0 && expiresAt <= Date.now() + 30_000) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;
      currentSession = refreshed.session;
    }

    return currentSession?.access_token ?? null;
  };

  const isAuthFailure = (error: unknown) =>
    error instanceof Error && error.message.includes("로그인이 필요합니다");

  const withFreshAccessToken = async <T,>(request: (accessToken: string) => Promise<T>) => {
    const accessToken = await getFreshAccessToken();
    if (!accessToken) throw new Error("로그인이 필요합니다.");

    try {
      return await request(accessToken);
    } catch (error) {
      // A token can be rejected before its local expiry (for example after a
      // refresh-token rotation). Refresh once and retry the same request.
      if (!isAuthFailure(error)) throw error;
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      const refreshedToken = refreshed.session?.access_token;
      if (refreshError || !refreshedToken) throw error;
      return request(refreshedToken);
    }
  };

  const loadCalendarEvents = async () => {
    if (eventsRequestRef.current) return eventsRequestRef.current;
    const ownerId = user?.id;
    const generation = eventsGenerationRef.current;
    if (!ownerId) return;
    const isCurrentRequest = () =>
      ownerIdRef.current === ownerId && eventsGenerationRef.current === generation;

    const request = (async () => {
      try {
        setEventsError(null);
        if (!session) return;
        const result = await withFreshAccessToken((token) =>
          getCalendarEventsFn({ data: { accessToken: token } }),
        );
        if (!isCurrentRequest()) return;
        const normalized = normalizeCalendarEvents(result.events) as CalendarEvent[];
        if (isCurrentRequest()) setEvents(normalized);
      } catch (error) {
        console.error("[calendar] 이벤트 조회 실패", error);
        if (isCurrentRequest()) {
          setEventsError(error instanceof Error ? error.message : "캘린더를 불러오지 못했어요.");
        }
      }
    })();

    eventsRequestRef.current = request;
    try {
      await request;
    } finally {
      if (eventsRequestRef.current === request) eventsRequestRef.current = null;
    }
  };

  useEffect(() => {
    if (authLoading) return;
    void loadCalendarEvents();
  }, [authLoading, session?.access_token]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) void loadCalendarEvents(); };
    window.addEventListener("calendar-events-changed", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("calendar-events-changed", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [session?.access_token]);
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();

  const days = useMemo(() => buildCalendarDays(year, month), [year, month]);
  const calendarVisibleEventRows = days.length === 35 ? 4 : 3;
  const eventsByDate = useMemo(() => {
    return events.reduce<Record<string, CalendarEvent[]>>((grouped, event) => {
      const start = event.date;
      const end = event.endDate ?? event.date;
      const cursor = new Date(`${start}T00:00:00`);
      const last = new Date(`${end}T00:00:00`);
      while (cursor <= last) {
        const key = toDateKey(cursor);
        grouped[key] = [...(grouped[key] ?? []), event];
        cursor.setDate(cursor.getDate() + 1);
      }
      return grouped;
    }, {});
  }, [events]);
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.date.localeCompare(b.date)),
    [events],
  );
  const calendarPeriodSegments = useMemo(
    () => buildCalendarPeriodSegments(events, days),
    [events, days],
  );
  const calendarDragSegments = useMemo(() => {
    if (!calendarDragStart || !calendarDragEnd) return [];
    const sortedDrag = [calendarDragStart, calendarDragEnd].sort();
    const startDate = sortedDrag[0] ?? calendarDragStart;
    const endDate = sortedDrag[1] ?? calendarDragEnd;
    return buildCalendarPeriodSegments(
      [{
        id: -1,
        title: "(제목 없음)",
        date: startDate,
        endDate,
        description: "",
      }],
      days,
    );
  }, [calendarDragStart, calendarDragEnd, days]);
  const periodLaneLimitByWeek = useMemo(() => {
    return Array.from({ length: days.length / 7 }, (_, weekIndex) => {
      const weekPeriodLaneCount = calendarPeriodSegments
        .filter((segment) => segment.weekIndex === weekIndex)
        .reduce((maxLane, segment) => Math.max(maxLane, segment.lane + 1), 0);

      const hasSingleDayEvent = days
        .slice(weekIndex * 7, weekIndex * 7 + 7)
        .some((day) =>
          (eventsByDate[day.key] ?? []).some(
            (event) => !event.endDate || event.endDate === event.date,
          ),
        );
      const needsOverflowRow =
        weekPeriodLaneCount > calendarVisibleEventRows ||
        (weekPeriodLaneCount === calendarVisibleEventRows && hasSingleDayEvent);

      return needsOverflowRow
        ? calendarVisibleEventRows - 1
        : calendarVisibleEventRows;
    });
  }, [calendarPeriodSegments, calendarVisibleEventRows, days, eventsByDate]);
  const visibleCalendarPeriodSegments = useMemo(
    () =>
      calendarPeriodSegments.filter(
        (segment) =>
          segment.lane < (periodLaneLimitByWeek[segment.weekIndex] ?? calendarVisibleEventRows),
      ),
    [calendarPeriodSegments, calendarVisibleEventRows, periodLaneLimitByWeek],
  );
  const hiddenPeriodCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const segment of calendarPeriodSegments) {
      if (segment.lane < (periodLaneLimitByWeek[segment.weekIndex] ?? calendarVisibleEventRows)) continue;
      for (let column = segment.startColumn; column < segment.startColumn + segment.span; column += 1) {
        const day = days[segment.weekIndex * 7 + column];
        if (!day) continue;
        counts[day.key] = (counts[day.key] ?? 0) + 1;
      }
    }
    return counts;
  }, [calendarPeriodSegments, calendarVisibleEventRows, days, periodLaneLimitByWeek]);
  const periodLaneCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const segment of visibleCalendarPeriodSegments) {
      for (let column = segment.startColumn; column < segment.startColumn + segment.span; column += 1) {
        const day = days[segment.weekIndex * 7 + column];
        if (!day) continue;
        counts[day.key] = Math.max(counts[day.key] ?? 0, segment.lane + 1);
      }
    }
    return counts;
  }, [visibleCalendarPeriodSegments, days]);
  const draggingChecklistItem = checklistItems.find((item) => item.id === draggingChecklistId) ?? null;
  const availableReminderQuickOptions = eventStartTime
    ? REMINDER_QUICK_OPTIONS
    : REMINDER_DATE_ONLY_OPTIONS;
  const availableReminderUnits = eventStartTime
    ? REMINDER_UNITS
    : REMINDER_UNITS.filter((unit) => unit.label === "일");

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const goToToday = () => {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(todayKey);
  };

  const startCalendarDrag = (dayKey: string, event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, a")) return;
    event.preventDefault();
    calendarDragMovedRef.current = false;
    setCalendarDragStart(dayKey);
    setCalendarDragEnd(null);
  };

  const moveCalendarDrag = (dayKey: string) => {
    if (!calendarDragStart) return;
    if (dayKey !== calendarDragStart) calendarDragMovedRef.current = true;
    setCalendarDragEnd(dayKey);
  };

  const finishCalendarDrag = (dayKey: string) => {
    if (!calendarDragStart) return;
    const wasMoved = calendarDragMovedRef.current;
    if (wasMoved) {
      const [startDate, endDate] = [calendarDragStart, dayKey].sort();
      openAddDialog(startDate, endDate === startDate ? "" : endDate, "calendar");
    }
    setCalendarDragStart(null);
    setCalendarDragEnd(null);
  };

  const openAddDialog = (dateKey?: string, endDate = "", origin: "toolbar" | "calendar" = "toolbar") => {
    calendarAddOriginRef.current = origin;
    const initialStartDate = dateKey ?? todayKey;
    const initialEndDate = endDate === initialStartDate ? "" : endDate;
    const initialMode: DateSelectionMode = initialEndDate ? "range" : "single";

    setEditingEventId(null);
    setEventTitle("");
    setEventColor(EVENT_COLORS[0].value);
    setColorPickerOpen(false);
    setProgramPickerOpen(false);
    setSelectedProgram(null);
    setProgramSearch("");
    setEventDescription("");
    setContentMode("memo");
    setChecklistItems([]);
    setFocusedChecklistId(null);
    setEventStartTime("");
    setReminders([]);
    setReminderPickerOpen(false);
    setReminderPickerMode("quick");
    setSaveError(null);
    setCustomReminderAmount("");
    setCustomReminderUnit("일");
    setReminderError("");
    setEventDate(initialStartDate);
    setEventEndDate(initialEndDate);
    setDateSelectionMode(initialMode);
    setInitialDateSelection({
      mode: initialMode,
      startDate: initialStartDate,
      endDate: initialEndDate,
    });
    setIsAddOpen(true);
  };

  const editSelectedEvent = () => {
    if (!selectedEvent) return;
    calendarAddOriginRef.current = "calendar";
    setEditingEventId(selectedEvent.id);
    setEventTitle(selectedEvent.title);
    setEventColor(selectedEvent.color ?? EVENT_COLORS[0].value);
    setColorPickerOpen(false);
    setEventDate(selectedEvent.date);
    setEventEndDate(selectedEvent.endDate ?? "");
    setDateSelectionMode(selectedEvent.endDate ? "range" : "single");
    setInitialDateSelection({
      mode: selectedEvent.endDate ? "range" : "single",
      startDate: selectedEvent.date,
      endDate: selectedEvent.endDate ?? "",
    });
    setEventDescription(selectedEvent.description);
    setContentMode(
      selectedEvent.contentMode ??
        (selectedEvent.checklistItems?.length ? "checklist" : "memo"),
    );
    setChecklistItems(
      (selectedEvent.checklistItems ?? []).map((item) => ({ ...item })),
    );
    setFocusedChecklistId(null);
    setEventStartTime(selectedEvent.startTime ?? "");
    setReminders(selectedEvent.reminders ?? []);
    setReminderPickerOpen(false);
    setReminderPickerMode("quick");
    setCustomReminderAmount("");
    setCustomReminderUnit(selectedEvent.startTime ? "분" : "일");
    setReminderError("");
    setSelectedEvent(null);
    setIsAddOpen(true);
  };

  const deleteSelectedEvent = async () => {
    if (!selectedEvent) return;
    const { data: latestSessionData } = await supabase.auth.getSession();
    const latestSession = latestSessionData.session;
    if (!latestSession?.user?.id || !latestSession.access_token) {
      setEventsError("로그인이 필요합니다.");
      return;
    }
    setIsSavingEvent(true);
    try {
      await mutateCalendarEventFn({ data: {
        userId: latestSession.user.id,
        eventId: selectedEvent.id,
        action: "delete",
        accessToken: latestSession.access_token,
      }});
      setSelectedEvent(null);
      setDeleteConfirmOpen(false);
      setEvents((current) => current.filter((event) => event.id !== selectedEvent.id));
      // 삭제 성공을 기다린 뒤 전체 목록을 다시 받아오면 n8n 조회 지연이
      // UI에 그대로 노출됩니다. 로컬 목록은 즉시 반영하고 서버 재조회는
      // 백그라운드에서 진행합니다.
      void loadCalendarEvents();
      window.dispatchEvent(new Event("calendar-events-changed"));
      window.dispatchEvent(new Event("notifications-changed"));
    } catch (error) {
      setEventsError(error instanceof Error ? error.message : "일정을 삭제하지 못했어요.");
    } finally {
      setIsSavingEvent(false);
    }
  };

  const getReminderAnchor = (unit?: ReminderUnit) => {
    if (!eventDate) return null;
    if (eventStartTime) {
      const anchor = new Date(`${eventDate}T${eventStartTime}`);
      return Number.isNaN(anchor.getTime()) ? null : anchor;
    }
    if (unit === "일") {
      return new Date(`${eventDate}T09:00:00`);
    }
    return null;
  };

  const getReminderError = (offsetMinutes: number, unit: ReminderUnit) => {
    const anchor = getReminderAnchor(unit);
    if (!anchor) {
      return unit === "일"
        ? "알림 기준 날짜를 먼저 선택하세요."
        : "분·시간 단위 알림은 시작 시간을 먼저 선택하세요.";
    }
    if (anchor.getTime() - offsetMinutes * 60_000 <= Date.now()) {
      return "계산된 알림 시간이 이미 지났어요. 더 짧은 시간을 선택하세요.";
    }
    return "";
  };

  const addReminder = (
    label: string,
    offsetMinutes?: number,
    unit?: ReminderUnit,
  ) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const error =
      offsetMinutes === undefined || unit === undefined
        ? ""
        : getReminderError(offsetMinutes, unit);
    if (error) {
      setReminderError(error);
      return;
    }
    setReminders((current) => {
      if (current.length >= REMINDER_MAX_ITEMS || current.includes(trimmed)) return current;
      return [...current, trimmed];
    });
    setReminderError("");
  };

  const addCustomReminder = () => {
    const amount = Number(customReminderAmount);
    const unit = REMINDER_UNITS.find((option) => option.label === customReminderUnit);
    if (!Number.isInteger(amount) || amount < 1 || !unit) {
      setReminderError("1 이상의 숫자를 입력하세요.");
      return;
    }
    const error = getReminderError(amount * unit.minutes, unit.label);
    if (error) {
      setReminderError(error);
      return;
    }
    addReminder(`${amount}${unit.label} 전`, amount * unit.minutes, unit.label);
    setCustomReminderAmount("");
    setReminderError("");
    setReminderPickerMode("quick");
  };

  const removeReminder = (label: string) => {
    setReminders((current) => current.filter((reminder) => reminder !== label));
  };

  const dismissReminderUnitHint = () => {
    setReminderUnitHintSeen(true);
    setReminderUnitHintOpen(false);
  };

  const closeReminderPicker = () => {
    setReminderPickerOpen(false);
    setReminderPickerMode("quick");
    setCustomReminderAmount("");
    setCustomReminderUnit(eventStartTime ? "분" : "일");
    setReminderError("");
  };

  const openProgramPicker = async () => {
    setHoveredProgramId(null);
    setProgramPickerOpen(true);
    if (savedPrograms.length > 0 || savedProgramsLoading) return;
    setSavedProgramsLoading(true);
    try {
      const response = await savedNoticesApi.getMySupportNotices();
      setSavedPrograms(response.items);
    } catch (error) {
      console.error("[calendar] 저장한 지원사업 조회 실패", error);
      setSavedPrograms([]);
    } finally {
      setSavedProgramsLoading(false);
    }
  };

  const createChecklistItem = (): ChecklistItem => ({
    id: Date.now(),
    text: "",
    completed: false,
  });

  const handleContentModeChange = (mode: ContentMode) => {
    setContentMode(mode);
    if (mode === "checklist" && checklistItems.length === 0) {
      const firstItem = createChecklistItem();
      setChecklistItems([firstItem]);
      setFocusedChecklistId(firstItem.id);
    }
  };

  const addChecklistItemAfter = (itemId: number) => {
    if (checklistItems.length >= CHECKLIST_MAX_ITEMS) return;
    const nextItem = createChecklistItem();
    setChecklistItems((current) => {
      const itemIndex = current.findIndex((item) => item.id === itemId);
      if (itemIndex === -1) return current;
      const next = [...current];
      next.splice(itemIndex + 1, 0, nextItem);
      return next;
    });
    setFocusedChecklistId(nextItem.id);
  };

  const updateChecklistItem = (id: number, text: string) => {
    setChecklistItems((current) =>
      current.map((item) => (item.id === id ? { ...item, text } : item)),
    );
  };

  const toggleChecklistItem = (id: number) => {
    setChecklistItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item,
      ),
    );
  };

  const toggleSelectedEventChecklistItem = async (itemId: number) => {
    let previous: ChecklistItem[] | null = null;
    let eventId: string | number | null = null;
    setSelectedEvent((current) => {
      if (!current) return current;
      previous = current.checklistItems ?? [];
      eventId = current.id;
      const nextItems = (current.checklistItems ?? []).map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item,
      );
      setEvents((events) =>
        events.map((event) =>
          event.id === current.id ? { ...event, checklistItems: nextItems } : event,
        ),
      );
      return { ...current, checklistItems: nextItems };
    });
    if (eventId === null) return;
    try {
      await withFreshAccessToken((accessToken) => mutateCalendarEventFn({
        data: { eventId, action: "toggle_checklist", itemId, accessToken },
      }));
      window.dispatchEvent(new Event("calendar-events-changed"));
    } catch (error) {
      const rollback = previous;
      setSelectedEvent((current) => current ? { ...current, checklistItems: rollback ?? [] } : current);
      setEvents((current) => current.map((event) => event.id === eventId ? { ...event, checklistItems: rollback ?? [] } : event));
      setEventsError(error instanceof Error ? error.message : "체크리스트를 저장하지 못했어요.");
    }
  };

  const removeChecklistItem = (id: number) => {
    const nextItems = checklistItems.filter((item) => item.id !== id);
    if (nextItems.length === 0) {
      const emptyItem = createChecklistItem();
      setChecklistItems([emptyItem]);
      setFocusedChecklistId(emptyItem.id);
      return;
    }

    setChecklistItems(nextItems);
    setFocusedChecklistId((current) => (current === id ? null : current));
  };

  const reorderChecklistItem = (
    sourceId: number,
    targetId: number,
    position: ChecklistDropPosition,
  ) => {
    if (sourceId === targetId) return;
    setChecklistItems((current) => {
      const movedItem = current.find((item) => item.id === sourceId);
      if (!movedItem) return current;
      const next = current.filter((item) => item.id !== sourceId);
      const targetIndex = next.findIndex((item) => item.id === targetId);
      if (targetIndex === -1) return current;
      next.splice(position === "after" ? targetIndex + 1 : targetIndex, 0, movedItem);
      return next;
    });
  };

  const saveEvent = async () => {
    if (isSavingEvent) return;
    const title = eventTitle.trim();
    if (!title || !eventDate) return;
    if (
      !eventStartTime &&
      reminders.some((reminder) => /(분|시간) 전$/.test(reminder))
    ) {
      setReminderError("시작 시간이 없는 알림은 먼저 삭제해주세요.");
      setReminderPickerOpen(true);
      return;
    }

    // 모든 신규 일정은 calendar-task-create로 저장합니다. 지원사업 연결과
    // 기간 여부는 요청을 건너뛸 이유가 아니며, 연결하지 않으면 null을 보냅니다.
    const isNewManualTask = editingEventId === null;
    if (isNewManualTask) {
      setIsSavingEvent(true);
      setSaveError(null);
      try {
        await withFreshAccessToken((accessToken) =>
          createCalendarTaskFn({
            data: {
              title,
              date: eventDate,
              end_date: dateSelectionMode === "range" ? eventEndDate : null,
              date_mode: dateSelectionMode,
              start_time: eventStartTime || null,
              description: eventDescription.trim(),
              content_mode: contentMode,
              checklist_items: checklistItems,
              reminders,
              client_request_id: crypto.randomUUID(),
              saved_notice_id: selectedProgram?.saved_notice_id ?? null,
              color: eventColor || "#6B7280",
              accessToken,
            },
          }),
        );
      } catch (error) {
        console.error("[calendar] 직접 할 일 저장 실패", error);
        setSaveError(error instanceof Error ? error.message : "할 일을 저장하지 못했어요.");
        return;
      } finally {
        setIsSavingEvent(false);
      }
    }

    if (editingEventId !== null) {
      setIsSavingEvent(true);
      setSaveError(null);
      try {
        await withFreshAccessToken(async (accessToken) => {
          const latestSession = (await supabase.auth.getSession()).data.session;
          if (!latestSession?.user?.id) throw new Error("로그인이 필요합니다.");
          return mutateCalendarEventFn({ data: {
            userId: latestSession.user.id,
            eventId: editingEventId,
            action: "update",
            title,
            startDate: eventDate,
            endDate: dateSelectionMode === "range" ? eventEndDate : null,
            dateMode: dateSelectionMode,
            startTime: eventStartTime || null,
            description: eventDescription.trim(),
            contentMode,
            checklistItems,
            reminders,
            color: eventColor || "#6B7280",
            allDay: true,
            accessToken,
          }});
        });
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "일정을 수정하지 못했어요.");
        return;
      } finally {
        setIsSavingEvent(false);
      }
    }

    const nextEvent: CalendarEvent = {
      id: editingEventId ?? Date.now(),
      title,
      color: eventColor,
      date: eventDate,
      ...(eventEndDate && eventEndDate !== eventDate ? { endDate: eventEndDate } : {}),
      description: eventDescription.trim(),
      contentMode,
      checklistItems: checklistItems
        .slice(0, CHECKLIST_MAX_ITEMS)
        .map((item) => ({
          ...item,
          text: item.text.trim().slice(0, CHECKLIST_ITEM_MAX_LENGTH),
        }))
        .filter((item) => item.text.length > 0),
      ...(eventStartTime ? { startTime: eventStartTime } : {}),
      ...(reminders.length ? { reminders } : {}),
    };
    if (!isNewManualTask) {
      setEvents((current) => {
        if (editingEventId === null) return [...current, nextEvent];
        return current.map((calendarEvent) =>
          calendarEvent.id === editingEventId ? nextEvent : calendarEvent,
        );
      });
    } else {
      // 신규 일정도 임시 ID로 먼저 화면에 반영해 저장 완료를 즉시 보여줍니다.
      // 실제 ID와 서버 상태는 아래 백그라운드 재조회로 동기화됩니다.
      setEvents((current) => [...current, nextEvent]);
    }
    const [eventYear, eventMonth] = eventDate.split("-").map(Number);
    if (
      eventYear !== undefined &&
      eventMonth !== undefined &&
      Number.isInteger(eventYear) &&
      Number.isInteger(eventMonth) &&
      calendarAddOriginRef.current === "toolbar" &&
      (eventYear !== year || eventMonth - 1 !== month)
    ) {
      setVisibleMonth(new Date(eventYear, eventMonth - 1, 1));
    }
    setSelectedDate(eventDate);
    setEditingEventId(null);
    setIsAddOpen(false);
    // n8n calendar-events 응답을 기다리지 않고 모달을 닫습니다.
    void loadCalendarEvents();
    window.dispatchEvent(new Event("calendar-events-changed"));
    window.dispatchEvent(new Event("notifications-changed"));
  };


  const moveChecklistHandle = (top: number) => {
    setChecklistHandleTop((current) => {
      if (current === null) {
        setChecklistHandleMotionEnabled(false);
        window.requestAnimationFrame(() => setChecklistHandleMotionEnabled(true));
      }
      return top;
    });
    setChecklistHandleVisible(true);
  };

  const startChecklistPointerDrag = (
    item: ChecklistItem,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();

    const row = event.currentTarget.closest<HTMLElement>("[data-checklist-row]");
    const list = row?.parentElement;
    if (!row || !list) return;

    const rowRect = row.getBoundingClientRect();
    let targetId: number | null = item.id;
    let targetPosition: ChecklistDropPosition = "before";

    const updateDragPosition = (clientY: number) => {
      const listRect = list.getBoundingClientRect();
      const maxTop = Math.max(0, list.scrollHeight - rowRect.height);
      const nextTop = Math.max(
        0,
        Math.min(maxTop, clientY - listRect.top - (event.clientY - rowRect.top)),
      );
      setChecklistGhostTop(nextTop);

      const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-checklist-row]"));
      const targetRow = rows.find((candidate) => {
        const bounds = candidate.getBoundingClientRect();
        return clientY >= bounds.top && clientY <= bounds.bottom;
      });

      if (!targetRow) {
        setDragOverChecklistId(null);
        return;
      }

      targetId = Number(targetRow.dataset["checklistId"]);
      const bounds = targetRow.getBoundingClientRect();
      targetPosition = clientY < bounds.top + bounds.height / 2 ? "before" : "after";
      setDragOverChecklistId(targetId);
      setDragOverPosition(targetPosition);
      moveChecklistHandle(targetRow.getBoundingClientRect().top - list.getBoundingClientRect().top + 10);
    };

    const finishDrag = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);

      if (targetId !== null && targetId !== item.id) {
        reorderChecklistItem(item.id, targetId, targetPosition);
      }

      setDraggingChecklistId(null);
      setChecklistGhostTop(null);
      setDragOverChecklistId(null);
      setChecklistHandleVisible(false);
      setChecklistHandleTop(null);
      setChecklistHandleMotionEnabled(false);
    };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      moveEvent.preventDefault();
      updateDragPosition(moveEvent.clientY);
    };

    setDraggingChecklistId(item.id);
    setChecklistGhostTop(Math.max(0, row.offsetTop));
    moveChecklistHandle(row.getBoundingClientRect().top - list.getBoundingClientRect().top + 10);
    setDragOverChecklistId(item.id);
    setDragOverPosition("before");
    updateDragPosition(event.clientY);

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", finishDrag, { once: true });
    window.addEventListener("pointercancel", finishDrag, { once: true });
  };

  return (
    <section aria-labelledby="calendar-title" className="w-[1208px]">
      <h1
        id="calendar-title"
        className="h-[33px] text-[28px] font-bold leading-[33px] text-ink"
      >
        전체 캘린더
      </h1>

      <div className="mt-[18px] flex h-[42px] items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={goToToday}
            className="h-[42px] rounded-[12px] border-field-border bg-surface px-4 text-[15px] font-semibold text-ink shadow-none hover:bg-item-hover hover:text-ink"
          >
            오늘
          </Button>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="이전 달"
              onClick={() => moveMonth(-1)}
              className="size-[42px] rounded-[12px] text-ink-muted hover:bg-item-hover hover:text-ink"
            >
              <ChevronLeft aria-hidden="true" className="!size-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="다음 달"
              onClick={() => moveMonth(1)}
              className="size-[42px] rounded-[12px] text-ink-muted hover:bg-item-hover hover:text-ink"
            >
              <ChevronRight aria-hidden="true" className="!size-5" />
            </Button>
          </div>
          <MonthField value={visibleMonth} onChange={setVisibleMonth} />
        </div>

        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-label="캘린더 보기 방식"
            className="relative h-[42px] w-28 rounded-[12px] bg-item-hover"
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-1/2 h-8 -translate-y-1/2 rounded-[8px] bg-surface shadow-[0_2px_6px_0_rgba(85,113,78,0.12)] transition-[left,width] duration-150 ease-out motion-reduce:transition-none",
                view === "month"
                  ? "left-[5px] w-11"
                  : "left-[51px] w-14",
              )}
            />
            <div className="absolute left-[5px] top-1/2 flex h-8 w-[102px] -translate-y-1/2 items-center justify-between">
              {(["month", "notice"] as const).map((option) => {
                const selected = view === option;
                const monthOption = option === "month";

                return (
                  <Button
                    key={option}
                    type="button"
                    variant="ghost"
                    onClick={() => setView(option)}
                    aria-pressed={selected}
                    className={cn(
                      "relative flex shrink-0 items-center justify-center px-[10px] py-[6px] text-[14px] font-normal leading-none transition-colors duration-150 motion-reduce:transition-none hover:bg-transparent",
                      selected
                        ? monthOption
                          ? "h-8 w-11 rounded-[12px] font-semibold text-ink hover:text-ink"
                          : "h-8 w-14 rounded-[6px] font-semibold text-ink hover:text-ink"
                        : monthOption
                          ? "h-7 w-11 rounded-[6px] text-control-inactive hover:text-control-inactive"
                          : "h-7 w-14 rounded-[6px] text-control-inactive hover:text-control-inactive",
                    )}
                  >
                    {monthOption ? "월별" : "공고별"}
                  </Button>
                );
              })}
            </div>
          </div>
          <Button
            type="button"
            onClick={() => openAddDialog()}
            className="h-[42px] w-28 rounded-[12px] bg-brand px-0 text-[15px] font-semibold text-brand-foreground shadow-none hover:bg-brand/88 active:bg-brand-pressed"
          >
            할 일 추가
          </Button>
        </div>
      </div>

      {view === "month" ? (
        <div className="mt-4 flex h-[760px] flex-col overflow-hidden rounded-[12px] border border-field-border bg-surface">
          <div className="grid h-10 grid-cols-7 border-b border-field-border" role="row">
            {DAYS_OF_WEEK.map((day) => (
              <div
                key={day}
                role="columnheader"
                className="flex items-center px-2 text-[13px] font-semibold text-ink-muted"
              >
                <span className="flex size-6 items-center justify-center">{day}</span>
              </div>
            ))}
          </div>
          <div
            className="relative min-h-0 flex-1"
            role="grid"
            aria-label={year + "년 " + (month + 1) + "월"}
          >
            <div className="grid h-full grid-cols-7 auto-rows-fr">
              {days.map((day, index) => {
                const isSelected = selectedDate === day.key;
                const isToday = todayKey === day.key;
                const dayEvents = [...(eventsByDate[day.key] ?? [])].sort(
                  (a, b) =>
                    getEventDurationDays(b) - getEventDurationDays(a) ||
                    a.date.localeCompare(b.date) ||
                    a.id - b.id,
                );
                const singleDayEvents = dayEvents.filter(
                  (calendarEvent) =>
                    !calendarEvent.endDate || calendarEvent.endDate === calendarEvent.date,
                );
                const periodLaneCount = periodLaneCountByDate[day.key] ?? 0;
                const hiddenPeriodCount = day.isCurrentMonth
                  ? hiddenPeriodCountByDate[day.key] ?? 0
                  : 0;
                const hasOverflow =
                  hiddenPeriodCount > 0 ||
                  periodLaneCount + singleDayEvents.length > calendarVisibleEventRows;
                const visibleRowLimit = hasOverflow
                  ? calendarVisibleEventRows - 1
                  : calendarVisibleEventRows;
                const visibleSingleCount = Math.max(
                  0,
                  visibleRowLimit - periodLaneCount,
                );
                const hiddenSingleCount =
                  hiddenPeriodCount +
                  Math.max(0, singleDayEvents.length - visibleSingleCount);

                return (
                  <div
                    key={day.key}
                    role="gridcell"
                    tabIndex={0}
                    aria-selected={isSelected}
                    aria-label={formatKoreanDate(day.key) + (isToday ? ", 오늘" : "")}
                    onPointerDown={(event) => startCalendarDrag(day.key, event)}
                    onPointerEnter={() => moveCalendarDrag(day.key)}
                    onPointerUp={() => finishCalendarDrag(day.key)}
                    onClick={() => {
                      if (calendarDragMovedRef.current) {
                        calendarDragMovedRef.current = false;
                        return;
                      }
                      openAddDialog(day.key, "", "calendar");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openAddDialog(day.key, "", "calendar");
                      }
                    }}
                    className={cn(
                      "group relative h-full min-w-0 cursor-pointer overflow-hidden bg-surface p-2 text-ink",
                      index < days.length - 7 && "border-b border-field-border",
                    )}
                  >
                    <div className="flex h-6 items-start justify-between gap-2">
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-sm font-normal leading-4",
                          !day.isCurrentMonth && "text-content-disabled",
                          day.isCurrentMonth && !isToday && !isSelected && "text-ink",
                          isToday && "w-[25px] bg-brand text-brand-foreground",
                        )}
                      >
                        {day.date.getDate()}
                      </span>
                      <Link
                        to="/calendar/growth-journal/new"
                        search={{ date: day.key, from: "calendar" }}
                        onClick={(event) => event.stopPropagation()}
                        className={cn(
                          "group/journal invisible flex h-6 items-center gap-0.5 rounded-[6px] bg-item-hover py-0.5 pl-[7px] pr-2 text-[13px] font-medium text-ink-muted hover:bg-calendar-journal-hover hover:text-brand",
                          "group-hover:visible",
                        )}
                      >
                        <img src="/assets/sidebar/journal-edit-default.svg" alt="" aria-hidden="true" className="h-[18px] w-3.5 object-contain group-hover/journal:hidden" />
                        <img src="/assets/sidebar/journal-edit-hover.svg" alt="" aria-hidden="true" className="hidden h-[18px] w-3.5 object-contain group-hover/journal:block" />
                        일지 쓰기
                      </Link>
                    </div>

                    {singleDayEvents.length > 0 || hiddenPeriodCount > 0 ? (
                      <div
                        className="mt-1.5 flex min-w-0 flex-col gap-0.5"
                        style={
                          periodLaneCountByDate[day.key]
                            ? { paddingTop: String(periodLaneCountByDate[day.key]! * 24) + "px" }
                            : undefined
                        }
                      >
                        {singleDayEvents.slice(0, visibleSingleCount).map((calendarEvent) => (
                          <button
                            key={calendarEvent.id}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedEvent(calendarEvent);
                            }}
                            className={cn(
                              "calendar-event-hover h-[22px] w-full truncate rounded-[6px] px-2 text-left text-xs font-normal",
                              calendarEvent.color ? "bg-pill text-pill-foreground" : "bg-item-hover text-ink-muted",
                            )}
                            style={{
                              backgroundColor: getSoftEventColor(calendarEvent.color),
                              color: getEventForegroundColor(calendarEvent.color),
                            }}
                          >
                            {calendarEvent.title}
                          </button>
                        ))}
                        {hiddenSingleCount > 0 ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedDayEvents({ date: day.key, events: dayEvents });
                            }}
                            className="h-[22px] w-full truncate rounded-[6px] px-2 text-left text-xs font-normal text-ink-muted hover:bg-item-hover hover:underline"
                          >
                            {hiddenSingleCount}개 더보기
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="pointer-events-none absolute inset-0">
              {Array.from({ length: days.length / 7 }, (_, weekIndex) => {
                const weekSegments = visibleCalendarPeriodSegments.filter(
                  (segment) => segment.weekIndex === weekIndex,
                );
                const weekDragSegments = calendarDragSegments.filter(
                  (segment) => segment.weekIndex === weekIndex,
                );

                return (
                  <div
                    key={"week-" + weekIndex}
                    className="absolute left-0 right-0 min-h-0 overflow-hidden"
                    style={{
                      top: String((weekIndex * 100) / (days.length / 7)) + "%",
                      height: String(100 / (days.length / 7)) + "%",
                    }}
                  >
                    <div
                      className="grid h-full grid-cols-7 grid-rows-1 items-start"
                      style={{ gridTemplateRows: "minmax(0, 1fr)" }}
                    >
                      {weekSegments.map((segment) => (
                        <button
                          key={segment.event.id + "-" + segment.weekIndex}
                          type="button"
                          aria-label={
                            segment.event.endDate
                              ? segment.event.title +
                                ", " +
                                formatKoreanDate(segment.event.date) +
                                "부터 " +
                                formatKoreanDate(segment.event.endDate) +
                                "까지"
                              : segment.event.title
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedEvent(segment.event);
                          }}
                          className={cn(
                            "calendar-event-hover z-10 flex items-center truncate px-2 text-xs font-normal",
                            calendarDragStart ? "pointer-events-none" : "pointer-events-auto",
                            !segment.isStart && segment.startColumn === 0 && "pl-4",
                            segment.event.color ? "bg-pill text-pill-foreground" : "bg-item-hover text-ink-muted",
                            segment.isStart && "rounded-l-[6px]",
                            segment.isEnd && "rounded-r-[6px]",
                          )}
                          style={{
                            backgroundColor: getSoftEventColor(segment.event.color),
                            color: getEventForegroundColor(segment.event.color),
                            gridColumn:
                              String(segment.startColumn + 1) +
                              " / span " +
                              String(segment.span),
                            gridRow: "1",
                            marginTop: String(38 + segment.lane * 24) + "px",
                            marginLeft: segment.isStart ? "8px" : undefined,
                            marginRight: segment.isEnd ? "8px" : undefined,
                            height: "22px",
                          }}
                        >
                          {segment.isStart || segment.startColumn === 0
                            ? segment.event.title
                            : "\u00a0"}
                        </button>
                      ))}

                      {weekDragSegments.map((segment) => (
                        <div
                          key={"drag-" + segment.weekIndex}
                          className={cn(
                            "pointer-events-none z-20 flex items-center truncate px-2 text-xs font-normal shadow-[0_4px_10px_0_rgba(22,59,49,0.18)]",
                            eventColor ? "text-pill-foreground" : "bg-item-hover text-ink-muted",
                            !segment.isStart && segment.startColumn === 0 && "pl-4",
                            segment.isStart && "rounded-l-[6px]",
                            segment.isEnd && "rounded-r-[6px]",
                          )}
                          style={{
                            gridColumn:
                              String(segment.startColumn + 1) +
                              " / span " +
                              String(segment.span),
                            gridRow: "1",
                            marginTop: "38px",
                            marginLeft: segment.isStart ? "8px" : undefined,
                            marginRight: segment.isEnd ? "8px" : undefined,
                            height: "22px",
                            backgroundColor: getSoftEventColor(eventColor),
                            color: getEventForegroundColor(eventColor),
                          }}
                        >
                          {segment.isStart || segment.startColumn === 0
                            ? "(제목 없음)"
                            : "\u00a0"}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <section aria-label="공고별 일정" className="mt-4 min-h-[736px] rounded-[12px] border border-field-border bg-surface p-6">
          {sortedEvents.length > 0 ? (
            <div className="divide-y divide-field-border">
              {sortedEvents.map((calendarEvent) => (
                <button
                  key={calendarEvent.id}
                  type="button"
                  onClick={() => setSelectedEvent(calendarEvent)}
                  className="flex w-full items-center gap-8 px-3 py-4 text-left hover:bg-item-hover"
                >
                  <time className="w-32 shrink-0 text-sm font-semibold text-brand">
                    {formatKoreanDate(calendarEvent.date)}
                  </time>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
                    {calendarEvent.title}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[688px] items-center justify-center text-sm text-ink-muted">
              등록된 할 일이 없습니다.
            </div>
          )}
        </section>
      )}

      <Dialog
        open={Boolean(eventsError)}
        onOpenChange={(open) => {
          if (!open) setEventsError(null);
        }}
      >
        <DialogContent
          closeClassName="right-5 top-5 flex size-9 items-center justify-center rounded-lg text-ink-muted opacity-100 transition-colors hover:bg-item-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-soft [&_svg]:size-6"
          className="w-[calc(100vw-32px)] max-w-[560px] overflow-hidden rounded-[20px] border-0 bg-surface"
        >
          <DialogHeader className="min-w-0 w-full max-w-full">
            <DialogTitle className="mb-4 pr-8 text-[20px] font-bold leading-7 text-ink">
              캘린더를 불러오지 못했어요.
            </DialogTitle>
            <DialogDescription role="alert" className="whitespace-pre-wrap text-[14px] leading-6 text-ink-muted">
              {eventsError}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) closeReminderPicker();
        }}
      >
        <DialogContent
          overlayClassName="bg-page"
          closeClassName="right-8 top-8 flex size-9 items-center justify-center rounded-lg text-icon-muted opacity-100 transition-colors hover:bg-item-hover hover:text-ink hover:opacity-100 focus:ring-0 focus:ring-offset-0 [&_svg]:size-6"
          className="!left-auto !right-5 !top-5 !translate-x-0 !translate-y-0 flex h-[min(1060px,calc(100dvh-40px))] max-h-[1060px] w-[592px] max-w-[calc(100vw-40px)] flex-col gap-0 rounded-[20px] border-0 bg-surface p-8 text-ink shadow-surface-card"
        >
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              void saveEvent();
            }}
          >
          <DialogHeader className="h-10 shrink-0 justify-center space-y-0 text-left">
            <DialogTitle className="pr-10 text-[24px] font-bold leading-10 text-ink">
              {editingEventId === null ? "할 일 추가" : "할 일 수정"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              캘린더에 표시할 할 일을 입력해주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 -mx-1 overflow-y-auto px-1 pt-[19px]">
            <div className="flex items-center gap-2">
              <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
                <PopoverAnchor asChild>
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={colorPickerOpen}
                  onClick={() => setColorPickerOpen((open) => !open)}
                  className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-[18px] border border-field-border bg-surface pl-3 pr-3 text-[14px] text-ink-muted hover:bg-item-hover"
                >
                  <span
                    aria-hidden="true"
                    className={cn("mr-1 size-2.5 rounded-full", !eventColor && "bg-icon-muted/50")}
                    style={{ backgroundColor: EVENT_COLORS.find((color) => color.value === eventColor)?.dotColor ?? "#D7E5E0" }}
                  />
                  <span>{EVENT_COLORS.find((color) => color.value === eventColor)?.label ?? "회색"}</span>
                  <ChevronDown aria-hidden="true" className="pointer-events-none size-4 text-ink-muted" />
                </button>
                </PopoverAnchor>
                <PopoverContent role="listbox" align="start" side="bottom" sideOffset={8} className="z-[100] w-auto min-w-[88px] rounded-[12px] border-0 bg-surface p-2 shadow-dropdown">
                    {EVENT_COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        role="option"
                        aria-selected={eventColor === color.value}
                        onClick={() => { setEventColor(color.value); setColorPickerOpen(false); }}
                        className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] px-2 text-[14px] text-ink hover:bg-item-hover"
                      >
                        <span
                          aria-hidden="true"
                          className={cn("size-2.5 rounded-full", !color.value && "bg-icon-muted/50")}
                          style={{ backgroundColor: color.dotColor }}
                        />
                        {color.label}
                      </button>
                    ))}
                </PopoverContent>
              </Popover>

              <Popover open={programPickerOpen} onOpenChange={setProgramPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={openProgramPicker}
                      className={cn(
                        "h-9 max-w-[320px] gap-1 rounded-[18px] border-field-border bg-surface pl-4 pr-3 text-[14px] font-normal shadow-none hover:bg-item-hover focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft",
                        selectedProgram ? "text-ink-muted hover:text-ink-muted" : "text-guide-text hover:text-guide-text",
                      )}
                    >
                      <span className="truncate">
                        {selectedProgram?.title ?? "지원사업 미선택"}
                      </span>
                      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="z-[100] w-[320px] rounded-[12px] border-0 bg-surface p-0 shadow-dropdown">
                  <div className="flex h-11 items-center gap-2 border-b border-field-border px-4">
                    <Search aria-hidden="true" className="size-5 shrink-0 -translate-x-0.5 text-ink-muted" />
                    <input
                      type="text"
                      value={programSearch}
                      onChange={(event) => setProgramSearch(event.target.value)}
                      placeholder="내 지원사업 검색"
                      aria-label="내 지원사업 검색"
                      className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-guide-text"
                    />
                    {programSearch.trim() ? (
                      <button
                        type="button"
                        aria-label="지원사업 검색어 지우기"
                        title="검색어 지우기"
                        onClick={() => setProgramSearch("")}
                        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-item-hover text-icon-muted transition-colors hover:bg-secondary-btn-hover"
                      >
                        <X aria-hidden="true" className="size-3" strokeWidth={2.5} />
                      </button>
                    ) : null}
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1">
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredProgramId(UNSELECTED_PROGRAM_HOVER_ID)}
                      onMouseLeave={() => setHoveredProgramId(null)}
                      onClick={() => {
                        setSelectedProgram(null);
                        setHoveredProgramId(null);
                        setProgramPickerOpen(false);
                      }}
                      aria-pressed={selectedProgram === null}
                      className={cn(
                        "flex w-full flex-col items-start gap-1 rounded-[8px] border border-transparent px-3 py-2 text-left hover:bg-item-hover",
                        selectedProgram === null && hoveredProgramId === null
                          ? "bg-item-hover"
                          : "bg-transparent",
                      )}
                    >
                      <span
                        className={cn(
                          "w-full truncate text-[14px] font-medium",
                          selectedProgram === null ? "text-brand" : "text-ink",
                        )}
                      >
                        선택 안 함
                      </span>
                    </button>
                  {savedProgramsLoading ? (
                    <p className="px-3 py-4 text-sm text-ink-muted">지원사업을 불러오는 중입니다.</p>
                  ) : savedPrograms.filter((program) => matchesSavedProgram(program, programSearch)).length === 0 ? (
                    programSearch.trim() ? (
                      <p className="px-4 py-4 text-sm text-ink-muted">검색 결과가 없습니다.</p>
                    ) : (
                      <div className="px-3 py-3 text-sm text-ink-muted">
                        <p>저장한 지원사업이 없어요.</p>
                      </div>
                    )
                  ) : (
                      savedPrograms.filter((program) => matchesSavedProgram(program, programSearch)).map((program) => (
                        <button
                          key={program.notice_id}
                          type="button"
                          onMouseEnter={() => setHoveredProgramId(program.notice_id)}
                          onMouseLeave={() => {
                            if (!selectedProgram) setHoveredProgramId(null);
                          }}
                          onClick={() => {
                            setSelectedProgram((current) =>
                              current?.notice_id === program.notice_id ? null : program,
                            );
                            setProgramPickerOpen(false);
                          }}
                          aria-pressed={selectedProgram?.notice_id === program.notice_id}
                          className={cn(
                            "flex w-full flex-col items-start gap-1 rounded-[8px] border border-transparent px-3 py-2 text-left hover:bg-item-hover",
                            hoveredProgramId === program.notice_id ||
                            (selectedProgram?.notice_id === program.notice_id && hoveredProgramId === null)
                              ? "bg-item-hover"
                              : "bg-transparent",
                          )}
                        >
                          <span
                            className={cn(
                              "w-full truncate text-[14px] font-medium",
                              selectedProgram?.notice_id === program.notice_id
                                ? "text-brand"
                                : "text-ink",
                            )}
                          >
                            {program.title}
                          </span>
                        </button>
                      ))
                  )}
                  </div>
                  </PopoverContent>
              </Popover>
            </div>

            <div className="mt-[18px] grid gap-1.5">
              <Label htmlFor="todo-title" className="text-sm font-semibold text-ink">
                제목<span className="relative -top-px ml-0.5 text-brand">*</span>
              </Label>
              <Input
                id="todo-title"
                value={eventTitle}
                onChange={(event) => setEventTitle(event.target.value)}
                placeholder="할 일 제목을 입력하세요"
                className="h-12 rounded-[12px] border-field-border px-3.5 text-[15px] md:text-[15px] text-ink shadow-none placeholder:text-guide-text focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft"
                autoFocus
              />
            </div>

            <div className="mt-[18px] grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-sm font-semibold text-ink">날짜</Label>
                <DateRangePicker
                  mode={dateSelectionMode}
                  startDate={eventDate}
                  endDate={eventEndDate}
                  initialMode={initialDateSelection.mode}
                  initialStartDate={initialDateSelection.startDate}
                  initialEndDate={initialDateSelection.endDate}
                  onModeChange={(nextMode) => {
                    setDateSelectionMode(nextMode);
                    if (nextMode === "single") setEventEndDate("");
                  }}
                  onChange={(startDate, endDate) => {
                    setEventDate(startDate);
                    setEventEndDate(endDate ?? "");
                  }}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="todo-time" className="text-sm font-semibold text-ink">시작 시간</Label>
                <TimeWheelPicker
                  id="todo-time"
                  value={eventStartTime}
                  onChange={(nextTime) => {
                    setEventStartTime(nextTime);
                    if (!nextTime) setCustomReminderUnit("일");
                  }}
                />
              </div>
            </div>

            <fieldset className="mt-[18px]">
              <legend className="text-sm font-semibold text-ink">알림</legend>
              <Popover
                open={reminderPickerOpen}
                onOpenChange={(open) => {
                  if (!open) {
                    closeReminderPicker();
                    return;
                  }
                  setReminderPickerMode("quick");
                  setCustomReminderAmount("");
                  setCustomReminderUnit(eventStartTime ? "분" : "일");
                  setReminderError("");
                  setReminderPickerOpen(true);
                }}
              >
                <PopoverAnchor asChild>
              <div className="relative mt-2 flex min-h-9 flex-wrap items-center gap-1.5">
                {reminders.length === 0 ? (
                  <span className="flex h-9 items-center rounded-[18px] bg-item-hover px-4 text-[14px] font-normal text-ink-muted">
                    알림 없음
                  </span>
                ) : (
                  reminders.map((reminder) => (
                    <span
                      key={reminder}
                      className="flex h-9 items-center gap-1 rounded-[18px] bg-pill pl-4 pr-2 text-[14px] font-semibold text-pill-foreground"
                    >
                      {reminder}
                      <button
                        type="button"
                        aria-label={`${reminder} 알림 삭제`}
                        onClick={() => removeReminder(reminder)}
                        className="flex size-5 items-center justify-center rounded-full text-pill-foreground transition-colors duration-150 ease-out hover:bg-transparent motion-reduce:transition-none"
                      >
                        <img
                          src="/assets/badge/close-20.svg"
                          alt=""
                          aria-hidden="true"
                          loading="eager"
                          decoding="sync"
                          className="size-4"
                        />
                      </button>
                    </span>
                  ))
                )}
                {reminders.length < REMINDER_MAX_ITEMS ? (
                  <Button
                    type="button"
                    variant="ghost"
                    aria-expanded={reminderPickerOpen}
                    onClick={() => {
                      setColorPickerOpen(false);
                      if (reminderPickerOpen) {
                        closeReminderPicker();
                      } else {
                        setReminderPickerMode("quick");
                        setCustomReminderAmount("");
                        setCustomReminderUnit(eventStartTime ? "분" : "일");
                        setReminderError("");
                        setReminderPickerOpen(true);
                      }
                    }}
                    className="h-9 gap-1 rounded-[18px] pl-3 pr-4 text-[14px] font-normal text-ink-muted hover:bg-item-hover hover:text-ink"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    알림 추가
                  </Button>
                ) : null}
                </div>
                </PopoverAnchor>
                {reminderPickerOpen && reminders.length < REMINDER_MAX_ITEMS ? (
                  <PopoverContent
                    role="group"
                  aria-label="알림 시간 선택"
                  align="start"
                  side="bottom"
                  sideOffset={8}
                  className={cn(
                    "rounded-[12px] border-0 bg-surface p-4 shadow-dropdown",
                    eventStartTime ? "w-[344px]" : "w-[320px]",
                  )}
                >                      {reminderPickerMode === "quick" ? (
                        <>
                          <div className="mb-2">
                            <p className="text-[14px] font-semibold text-ink">알림 추가</p>
                          </div>
                          <div className="flex w-full flex-nowrap items-center gap-1">
                            {availableReminderQuickOptions.map((option) => {
                              const added = reminders.includes(option.label);
                              return (
                                <button
                                  key={option.label}
                                  type="button"
                                  aria-pressed={added}
                                  onClick={() => {
                                    if (added) {
                                      removeReminder(option.label);
                                      return;
                                    }
                                    addReminder(
                                      option.label,
                                      option.minutes,
                                      option.minutes >= 1440
                                        ? "일"
                                        : option.minutes >= 60
                                          ? "시간"
                                          : "분",
                                    );
                                  }}
                                  className={cn(
                                    "flex h-8 items-center rounded-[16px] px-3 text-[13px] font-normal transition-colors duration-150 ease-out motion-reduce:transition-none",
                                    added
                                      ? "cursor-pointer bg-pill font-semibold text-pill-foreground"
                                      : "bg-item-hover text-ink-muted hover:bg-[#F1F3F2] hover:text-ink-muted",
                                  )}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setReminderError("");
                                setReminderPickerMode("custom");
                              }}
                              className="h-8 rounded-[16px] border border-field-border bg-surface px-3 text-[13px] font-normal text-ink-muted hover:bg-item-hover hover:text-ink-muted"
                            >
                              직접 입력
                            </Button>
                          </div>
                          {reminderError ? (
                            <p role="alert" className="mt-2 text-[12px] leading-4 text-[#B44A4A]">
                              {reminderError}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <div className="flex items-start gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="빠른 알림으로 돌아가기"
                              onClick={() => {
                                setReminderError("");
                                setReminderPickerMode("quick");
                              }}
                              className="-ml-1 h-5 w-5 shrink-0 rounded-[5px] p-0 text-ink-muted hover:bg-item-hover hover:text-ink focus-visible:outline-none focus-visible:ring-[3.2px] focus-visible:ring-focus-soft"
                            >
                              <ChevronLeft aria-hidden="true" className="size-4" />
                            </Button>
                            <p className="text-[14px] font-semibold text-ink">직접 알림 설정</p>
                          </div>
                          <div className="mt-2 flex h-11 items-center overflow-hidden rounded-[8px] border border-field-border bg-surface transition-colors focus-within:border-brand focus-within:ring-[3.2px] focus-within:ring-focus-soft">
                            <div className="flex h-full min-w-0 flex-1 items-center">
                            <Input
                              value={customReminderAmount}
                              onChange={(event) =>
                                setCustomReminderAmount(event.target.value.replace(/\D/g, "").slice(0, 4))
                              }
                              onClick={() => {
                                if (reminderError) {
                                  setCustomReminderAmount("");
                                  setReminderError("");
                                }
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  addCustomReminder();
                                }
                              }}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="숫자 입력"
                              aria-label="알림 전 숫자"
                              autoFocus
                              className="h-full min-w-0 flex-1 rounded-none border-0 px-3 text-[14px] text-ink shadow-none placeholder:text-guide-text focus-visible:border-0 focus-visible:ring-0"
                            />
                            {availableReminderUnits.length > 1 ? (
                              <span aria-hidden="true" className="h-full w-px shrink-0 bg-field-border" />
                            ) : null}
                            {availableReminderUnits.length <= 1 ? (
                              <span className="flex h-full w-[72px] shrink-0 items-center justify-center bg-item-hover text-[14px] text-icon-muted">
                                일 전
                              </span>
                            ) : (
                            <Tooltip
                              open={
                                availableReminderUnits.length > 1 &&
                                !reminderUnitHintSeen &&
                                reminderUnitHintOpen
                              }
                              onOpenChange={(open) => {
                                if (!reminderUnitHintSeen) setReminderUnitHintOpen(open);
                              }}
                            >
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  disabled={availableReminderUnits.length <= 1}
                                  aria-label={`알림 시간 단위: ${customReminderUnit}. 클릭하여 변경`}
                                  onPointerEnter={() => {
                                    if (
                                      availableReminderUnits.length > 1 &&
                                      !reminderUnitHintSeen
                                    ) {
                                      setReminderUnitHintOpen(true);
                                    }
                                  }}
                                  onPointerLeave={() => setReminderUnitHintOpen(false)}
                                  onFocus={() => {
                                    if (
                                      availableReminderUnits.length > 1 &&
                                      !reminderUnitHintSeen
                                    ) {
                                      setReminderUnitHintOpen(true);
                                    }
                                  }}
                                  onBlur={() => setReminderUnitHintOpen(false)}
                                  onClick={() => {
                                    if (availableReminderUnits.length <= 1) return;
                                    const currentIndex = availableReminderUnits.findIndex(
                                      (unit) => unit.label === customReminderUnit,
                                    );
                                    const nextIndex =
                                      currentIndex === -1
                                        ? 0
                                        : (currentIndex + 1) % availableReminderUnits.length;
                                    setCustomReminderUnit(availableReminderUnits[nextIndex]!.label);
                                    dismissReminderUnitHint();
                                  }}
                                  className="h-full w-[54px] shrink-0 cursor-pointer border-0 bg-surface px-2 text-center text-[14px] text-ink outline-none disabled:cursor-default"
                                >
                                  {customReminderUnit}
                                </button>
                              </TooltipTrigger>
                              {availableReminderUnits.length > 1 ? (
                                <TooltipContent
                                  side="bottom"
                                  sideOffset={6}
                                  className="rounded-[6px] bg-tooltip px-2 py-1.5 text-[12px] font-medium leading-[18px] text-tooltip-foreground shadow-none"
                                >
                                  클릭으로 전환
                                </TooltipContent>
                              ) : null}
                            </Tooltip>
                            )}
                            {availableReminderUnits.length > 1 ? (
                              <span className="flex h-full w-[54px] shrink-0 items-center justify-center bg-item-hover text-[14px] text-icon-muted">
                                전
                              </span>
                            ) : null}
                            </div>
                            <Button
                              type="button"
                              disabled={!customReminderAmount}
                              onClick={addCustomReminder}
                              className="h-full w-[64px] shrink-0 rounded-none bg-brand px-2 text-[14px] font-semibold text-brand-foreground shadow-none hover:bg-brand/88 disabled:bg-brand-disabled disabled:text-brand-foreground disabled:opacity-100"
                            >
                              추가
                            </Button>
                          </div>
                          {customReminderAmount ? (
                            <p className="mt-2 text-[13px] text-ink-muted">
                              {customReminderAmount}{customReminderUnit} 전
                            </p>
                          ) : null}
                          {reminderError ? (
                            <p role="alert" className="mt-2 text-[12px] leading-4 text-[#B44A4A]">
                              {reminderError}
                            </p>
                          ) : null}
                        </>
                      )}

                  </PopoverContent>
                ) : null}
              </Popover>
            </fieldset>

            <div className="mt-[18px]">
              <div className="flex items-end justify-between">
                <Label htmlFor="todo-description" className="relative -top-0.5 text-sm font-semibold text-ink">
                  상세 내용
                </Label>
                <div
                  role="group"
                  aria-label="상세 내용 형식"
                  className="relative -top-px flex h-8 w-[116px] items-center rounded-[8px] bg-item-hover p-0.5"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-1 h-6 rounded-[6px] bg-surface shadow-[0_1px_3px_0_rgba(85,113,78,0.1)] transition-[left,width] duration-150 ease-out motion-reduce:transition-none",
                      contentMode === "memo"
                        ? "left-1 w-9"
                        : "left-[42px] w-[70px]",
                    )}
                  />
                  <div className="relative z-10 flex w-[114px] items-center justify-start">
                    {(["memo", "checklist"] as const).map((mode) => {
                      const selected = contentMode === mode;
                      return (
                        <Button
                          key={mode}
                          type="button"
                          variant="ghost"
                          aria-pressed={selected}
                          onClick={() => handleContentModeChange(mode)}
                          className={cn(
                            "h-7 rounded-[6px] px-2.5 text-[12px] font-normal text-control-inactive shadow-none",
                            mode === "memo" ? "w-10" : "w-[70px] px-2",
                            selected
                              ? "font-semibold text-ink hover:bg-transparent hover:text-ink"
                              : "bg-transparent hover:bg-transparent hover:text-control-inactive",
                          )}
                        >
                          {mode === "memo" ? "메모" : "체크리스트"}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {contentMode === "memo" ? (
                <div className="relative mt-1.5">
                  <LayeredTextarea
                    id="todo-description"
                    value={eventDescription}
                    onChange={(event) => setEventDescription(event.target.value)}
                    maxLength={500}
                    placeholder="메모할 내용이 있으면 적어주세요."
                    placeholderClassName="left-3.5 top-3 text-[14px] leading-5 text-guide-text"
                    className="h-[164px] resize-none rounded-[12px] border-field-border px-3.5 py-3 pb-3 text-[14px] leading-5 text-ink shadow-none focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft"
                  />
                  <span
                    aria-live="polite"
                    className="pointer-events-none absolute bottom-2 right-2 inline-flex rounded-[4px] bg-surface px-2 py-1 text-[12px] leading-3 text-icon-muted"
                  >
                    <span className={eventDescription.length > 0 ? "text-ink" : "text-icon-muted"}>{eventDescription.length}</span>/500
                  </span>
                </div>
              ) : (
                <div className="mt-1 -translate-y-[4px] rounded-[12px] bg-surface py-2.5 pl-0 pr-2.5">
                  <div className="group/checklist-list relative flex flex-col gap-0" onMouseLeave={() => setChecklistHandleVisible(false)}>
                    <span aria-hidden="true" className="pointer-events-none absolute bottom-3 left-0.5 top-2.5 z-0 w-0.5 rounded-full bg-field-border/70" />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none absolute left-0.5 z-10 h-[18px] w-0.5 rounded-full bg-icon-muted duration-150 ease-out group-hover/checklist-list:w-[3px]",
                        checklistHandleMotionEnabled
                          ? "transition-[top,opacity,width]"
                          : "transition-[opacity,width]",
                      )}
                      style={{ top: checklistHandleTop ?? 0, opacity: checklistHandleVisible ? 1 : 0 }}
                    />
                    {draggingChecklistItem && checklistGhostTop !== null ? (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute left-6 right-2 z-20 flex h-10 items-start gap-2.5 pt-2.5 opacity-80"
                        style={{ top: checklistGhostTop }}
                      >
                        <span
                          className={cn(
                            "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border",
                            draggingChecklistItem.completed
                              ? "border-brand bg-brand text-brand-foreground"
                              : "border-field-border bg-surface",
                          )}
                        >
                          {draggingChecklistItem.completed ? <Check className="size-3" /> : null}
                        </span>
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-[15px] leading-5 text-ink",
                            draggingChecklistItem.completed && "text-icon-muted line-through",
                          )}
                        >
                          {draggingChecklistItem.text || `항목 ${checklistItems.findIndex((item) => item.id === draggingChecklistItem.id) + 1}`}
                        </span>
                      </div>
                    ) : null}
                    {checklistItems.map((item, index) => {
                      return (
                        <div
                          key={item.id}
                          data-checklist-row
                          data-checklist-id={item.id}
                          onMouseEnter={(event) => {
                            moveChecklistHandle(
                              event.currentTarget.getBoundingClientRect().top -
                                event.currentTarget.parentElement!.getBoundingClientRect().top +
                                10,
                            );
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            moveChecklistHandle(
                              event.currentTarget.getBoundingClientRect().top -
                                event.currentTarget.parentElement!.getBoundingClientRect().top +
                                10,
                            );
                            event.dataTransfer.dropEffect = "move";
                            const bounds = event.currentTarget.getBoundingClientRect();
                            const position: ChecklistDropPosition =
                              event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
                            setDragOverChecklistId(item.id);
                            setDragOverPosition(position);
                          }}
                          onDragLeave={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                              setDragOverChecklistId(null);
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            const sourceId = Number(event.dataTransfer.getData("text/plain"));
                            if (Number.isNaN(sourceId)) return;
                            const position =
                              dragOverChecklistId === item.id ? dragOverPosition : "before";
                            reorderChecklistItem(sourceId, item.id, position);
                            setDraggingChecklistId(null);
                            setDragOverChecklistId(null);
                          }}
                          className={cn(
                            "group/checklist-row relative grid grid-cols-[16px_20px_minmax(0,1fr)_32px] items-start gap-2 rounded-[8px] py-1 pl-0 pr-2 transition-[opacity,transform,box-shadow] duration-150 ease-out",
                            draggingChecklistId === item.id &&
                              "opacity-40",
                          )}
                        >
                          {draggingChecklistId !== null &&
                          dragOverChecklistId === item.id &&
                          draggingChecklistId !== item.id &&
                          dragOverPosition === "before" ? (
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-x-2 -top-px h-0.5 rounded-full bg-brand"
                            />
                          ) : null}

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`항목 ${index + 1} 순서 이동`}
                            onPointerDown={(event) => startChecklistPointerDrag(item, event)}
                            className="pointer-events-none relative z-10 col-start-1 mt-0 h-8 w-6 shrink-0 cursor-grab rounded-[8px] text-icon-muted opacity-0 shadow-none transition-opacity active:cursor-grabbing group-hover/checklist-row:pointer-events-auto group-hover/checklist-row:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 hover:bg-transparent hover:text-icon-muted"
                          />
                          <Checkbox
                            checked={item.completed}
                            aria-label={item.completed ? `항목 ${index + 1} 완료 취소` : `항목 ${index + 1} 완료`}
                            onCheckedChange={() => toggleChecklistItem(item.id)}
                            className="mt-1.5 size-[18px] shrink-0 rounded-[5px] border-field-border [&_svg]:size-3 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-brand-foreground"
                          />
                          <div className="relative min-w-0 flex-1">
                            <LayeredTextarea
                              value={item.text}
                              rows={1}
                              maxLength={CHECKLIST_ITEM_MAX_LENGTH}
                              autoFocus={focusedChecklistId === item.id}
                              onFocus={(event) => {
                                setFocusedChecklistId(item.id);
                                resizeChecklistTextarea(event.currentTarget);
                              }}
                              onBlur={() => setFocusedChecklistId(null)}
                              onInput={(event) => resizeChecklistTextarea(event.currentTarget)}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                                if (item.text.trim().length === 0 && index === checklistItems.length - 1) return;
                                event.preventDefault();
                                addChecklistItemAfter(item.id);
                              }}
                              onChange={(event) => updateChecklistItem(item.id, event.target.value)}
                              placeholder={`항목 ${index + 1}`}
                              placeholderClassName="left-0 top-1 truncate text-[15px] leading-5 text-guide-text"
                              className={cn(
                                "h-8 !min-h-8 max-h-16 resize-none overflow-y-auto rounded-none border border-transparent bg-transparent px-0 py-1 text-[15px] md:text-[15px] leading-5 text-ink shadow-none focus-visible:border-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-focus-soft",
                                item.completed && "text-icon-muted line-through",
                              )}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`항목 ${index + 1} 삭제`}
                            onClick={() => removeChecklistItem(item.id)}
                            className="pointer-events-none col-start-4 mt-0 size-8 shrink-0 translate-x-2.5 rounded-[8px] text-icon-muted opacity-0 shadow-none transition-opacity group-hover/checklist-row:pointer-events-auto group-hover/checklist-row:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 hover:bg-item-hover hover:text-[#62756E]"
                          >
                            <span
                              aria-hidden="true"
                              className="size-4 bg-current"
                              style={{
                                maskImage: "url('/assets/sidebar/delete.svg')",
                                maskPosition: "center",
                                maskRepeat: "no-repeat",
                                maskSize: "contain",
                              }}
                            />
                          </Button>
                          {draggingChecklistId !== null &&
                          dragOverChecklistId === item.id &&
                          draggingChecklistId !== item.id &&
                          dragOverPosition === "after" ? (
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand"
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>


                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6 h-12 shrink-0 flex-row justify-end gap-2 sm:space-x-0">
            {saveError ? (
              <p role="alert" className="mr-auto self-center text-[13px] text-[#B44A4A]">
                {saveError}
              </p>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddOpen(false)}
              className="h-12 w-[89px] rounded-[12px] bg-secondary-btn text-[16px] font-semibold text-secondary-btn-text shadow-none hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={!eventTitle.trim() || !eventDate || isSavingEvent}
              className="h-12 w-[119px] rounded-[12px] bg-brand text-[16px] font-semibold text-brand-foreground shadow-none hover:bg-brand/88 active:bg-brand-pressed disabled:bg-brand-disabled disabled:opacity-100"
            >
              {isSavingEvent ? "저장 중..." : "저장하기"}
            </Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedDayEvents !== null}
        onOpenChange={(open) => !open && setSelectedDayEvents(null)}
      >
        <DialogContent
          closeClassName="right-8 top-8 flex size-9 items-center justify-center rounded-lg text-icon-muted opacity-100 transition-colors hover:bg-item-hover hover:text-ink hover:opacity-100 focus:ring-0 focus:ring-offset-0 [&_svg]:size-6"
          className="rounded-[12px] border-0 bg-surface pb-8 text-ink shadow-[0_12px_16px_0_rgba(9,31,23,0.12)] sm:max-w-[460px]"
        >
          <DialogHeader>
            <DialogTitle className="min-w-0 max-w-[calc(100%-80px)] truncate whitespace-nowrap text-[20px] font-bold leading-7 text-ink">
              {selectedDayEvents ? formatKoreanDate(selectedDayEvents.date) : ""}
            </DialogTitle>
            <DialogDescription className="text-sm text-ink-muted">
              등록된 일정
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto">
            {selectedDayEvents?.events.map((calendarEvent) => (
              <button
                key={calendarEvent.id}
                type="button"
                onClick={() => {
                  setSelectedDayEvents(null);
                  setSelectedEvent(calendarEvent);
                }}
                className="h-10 w-full truncate rounded-[8px] bg-menu-hover px-3 text-left text-sm font-normal text-ink hover:bg-item-hover-selected"
              >
                {calendarEvent.title}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedEvent !== null && !deleteConfirmOpen}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      >
        <DialogContent
          closeClassName="right-8 top-5 flex size-9 items-center justify-center rounded-lg text-icon-muted opacity-100 transition-colors hover:bg-item-hover hover:text-ink hover:opacity-100 focus:outline-none focus:ring-0 focus:ring-offset-0 [&_svg]:size-6"
          className="rounded-[12px] border-0 bg-surface p-7 text-ink shadow-[0_12px_16px_0_rgba(9,31,23,0.12)] sm:max-w-[600px]"
        >
          <div className="absolute right-[72px] top-5 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="일정 수정"
              onClick={editSelectedEvent}
              className="group size-9 rounded-lg text-icon-muted transition-colors hover:bg-item-hover hover:text-ink"
            >
              <span
                aria-hidden="true"
                className="size-[18px] bg-icon-muted group-hover:bg-ink"
                style={{
                  maskImage: "url('/assets/sidebar/profile-edit-tooltip.svg')",
                  WebkitMaskImage: "url('/assets/sidebar/profile-edit-tooltip.svg')",
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskPosition: "center",
                  maskSize: "150%",
                  WebkitMaskSize: "150%",
                }}
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="일정 삭제"
              onClick={() => setDeleteConfirmOpen(true)}
              className="group size-9 rounded-lg text-icon-muted transition-colors hover:bg-item-hover hover:text-ink"
            >
              <span
                aria-hidden="true"
                className="size-[18px] bg-icon-muted group-hover:bg-ink"
                style={{
                  maskImage: "url('/assets/sidebar/delete.svg')",
                  WebkitMaskImage: "url('/assets/sidebar/delete.svg')",
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskPosition: "center",
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                }}
              />
            </Button>
          </div>
          <DialogHeader>
            <DialogDescription className="text-[16px] font-semibold leading-6 text-ink-muted">
              {selectedEvent ? (
                <span className="inline-flex items-center gap-2">
                  <span>
                    {selectedEvent.endDate
                      ? `${formatDateLabel(selectedEvent.date)} ~ ${formatDateLabel(selectedEvent.endDate)}`
                      : formatDateLabel(selectedEvent.date)}
                  </span>
                  {selectedEvent.startTime ? (
                    <span className="inline-flex items-center rounded-full bg-item-hover px-2 py-0.5 text-[13px] font-semibold leading-5 text-ink-muted">
                      {formatTimeLabel(selectedEvent.startTime)}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </DialogDescription>
            <DialogTitle className="mt-3 line-clamp-2 text-[24px] font-bold leading-8 text-ink">
              {selectedEvent?.title}
            </DialogTitle>
          </DialogHeader>
          <div
            className={cn(
              "mt-0 space-y-4",
              selectedEvent?.description || selectedEvent?.checklistItems?.length ? "min-h-16" : "",
            )}
          >
            {selectedEvent?.description ? (
              <p className="whitespace-pre-wrap rounded-[12px] border border-field-border px-3 py-2 text-[15px] leading-6 text-ink-muted">
                {selectedEvent.description}
              </p>
            ) : null}
            {selectedEvent?.checklistItems?.length ? (
              <div className="space-y-2">
                <div className="flex items-center text-sm">
                  <span className="font-semibold text-ink">
                    체크리스트 <span className="font-normal text-ink-muted">(
                      {selectedEvent.checklistItems.filter((item) => item.completed).length}/
                      {selectedEvent.checklistItems.length})
                    </span>
                  </span>
                </div>
                <div className="space-y-1.5">
                  {selectedEvent.checklistItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleSelectedEventChecklistItem(item.id)}
                      className="flex w-full items-center gap-2 rounded-[8px] py-1 text-left text-[15px]"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-[5px] border",
                          item.completed
                            ? "border-brand bg-brand text-brand-foreground"
                            : "border-field-border bg-surface",
                        )}
                      >
                        {item.completed ? <Check className="size-3.5" /> : null}
                      </span>
                      <span className={cn("min-w-0 flex-1", item.completed && "text-icon-muted line-through")}>
                        {item.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {!selectedEvent?.description && !selectedEvent?.checklistItems?.length ? (
              <p className="text-sm leading-6 text-ink-muted">등록된 상세 내용이 없습니다.</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
    <AlertDialogContent className="w-[calc(100vw-32px)] max-w-[420px] rounded-[20px] border-0 bg-surface p-8 [&>button:last-child]:top-7">
          <AlertDialogHeader className="space-y-2 text-left">
            <AlertDialogTitle className="pr-8 text-[20px] font-bold leading-7 text-ink">
              일정을 삭제할까요?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[14px] leading-6 text-ink-muted">
              삭제한 일정은 복구할 수 없어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
      <AlertDialogFooter className="mt-2 flex-row justify-end gap-2 sm:space-x-0">
        <AlertDialogCancel className="mt-0 h-11 rounded-[12px] border-0 bg-secondary-btn px-5 text-[15px] font-semibold text-secondary-btn-text shadow-none hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
          className="h-11 rounded-[12px] border-0 bg-destructive px-5 text-[15px] font-semibold text-white shadow-none hover:bg-destructive/90 focus-visible:ring-1 focus-visible:ring-focus-soft"
              onClick={() => void deleteSelectedEvent()}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
