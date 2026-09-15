import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";

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
      { title: "전체 캘린더 — SSIAT" },
      {
        name: "description",
        content: "지원사업 일정과 할 일을 월별 또는 공고별로 관리하는 SSIAT 전체 캘린더입니다.",
      },
      { property: "og:title", content: "전체 캘린더 — SSIAT" },
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
  id: number;
  title: string;
  date: string;
  endDate?: string;
  description: string;
  contentMode?: ContentMode;
  checklistItems?: ChecklistItem[];
  startTime?: string;
  reminders?: string[];
};

type CalendarDay = {
  date: Date;
  key: string;
  isCurrentMonth: boolean;
};

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
    const weekStart = weekDays[0].key;
    const weekEnd = weekDays[6].key;
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
        lanes[lane].push({ start: startColumn, end: endColumn });
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
  onModeChange: (mode: DateSelectionMode) => void;
  onChange: (startDate: string, endDate?: string) => void;
};

function DateRangePicker({
  mode,
  startDate,
  endDate,
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
  const dragMovedRef = useRef(false);

  const days = useMemo(
    () => buildCalendarDays(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth],
  );

  const syncDraft = () => {
    setDraftStart(startDate);
    setDraftEnd(endDate);
    const base = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
    setVisibleMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  };

  const closePicker = () => {
    setIsDragging(false);
    setOpen(false);
  };

  const commitRange = (candidateEnd: string) => {
    if (!draftStart) return;
    const [start, end] = [draftStart, candidateEnd].sort();
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
          <ChevronDown aria-hidden="true" className="size-5 text-ink-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[320px] rounded-[12px] border-field-border bg-surface p-3 shadow-dropdown">
        <div className="flex items-center">
          <div className="flex rounded-[8px] bg-item-hover p-0.5">
            {(["single", "range"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onModeChange(option);
                  if (option === "single") {
                    setDraftEnd("");
                    onChange(draftStart || startDate, undefined);
                  }
                }}
                className={cn(
                  "h-8 rounded-[6px] px-3 text-[13px] transition-colors",
                  mode === option
                    ? "bg-surface font-semibold text-ink shadow-sm"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {option === "single" ? "단일" : "기간"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between px-1">
          <span className="text-[15px] font-semibold text-ink">
            {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="이전 달"
              onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              className="size-8 rounded-[6px] text-ink-muted hover:bg-item-hover hover:text-ink"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="다음 달"
              onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              className="size-8 rounded-[6px] text-ink-muted hover:bg-item-hover hover:text-ink"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 text-center text-[12px] font-semibold text-ink-muted">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
            <span key={day} className="flex h-7 items-center justify-center">{day}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((day) => {
            const selectedStart = rangeStart === day.key;
            const selectedEnd = rangeEnd === day.key;
            const inRange =
              mode === "range" &&
              rangeStart &&
              rangeEnd &&
              day.key >= rangeStart &&
              day.key <= rangeEnd;
            return (
              <button
                key={day.key}
                type="button"
                onPointerDown={(event) => handleDayPointerDown(day.key, event)}
                onPointerEnter={() => handleDayPointerEnter(day.key)}
                onPointerUp={() => handleDayPointerUp(day.key)}
                onClick={() => handleDayClick(day.key)}
                className={cn(
                  "mx-0.5 flex h-9 items-center justify-center rounded-[7px] text-[14px] transition-colors",
                  !day.isCurrentMonth && "text-content-disabled",
                  day.isCurrentMonth && !inRange && "text-ink hover:bg-item-hover",
                  inRange && "bg-pill text-pill-foreground",
                  (selectedStart || selectedEnd) && "bg-brand font-semibold text-brand-foreground",
                )}
              >
                {day.date.getDate()}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-field-border pt-2">
          <button
            type="button"
            onClick={() => {
              setDraftStart("");
              setDraftEnd("");
              onChange("");
              closePicker();
            }}
            className="text-[13px] text-ink-muted hover:text-ink"
          >
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
            className="text-[13px] font-semibold text-brand hover:underline"
          >
            오늘
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}


function CalendarPage() {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: string; events: CalendarEvent[] } | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [dateSelectionMode, setDateSelectionMode] = useState<DateSelectionMode>("single");
  const [calendarDragStart, setCalendarDragStart] = useState<string | null>(null);
  const [calendarDragEnd, setCalendarDragEnd] = useState<string | null>(null);
  const [hoveredPeriodEventId, setHoveredPeriodEventId] = useState<number | null>(null);
  const calendarDragMovedRef = useRef(false);
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
  const [customReminderAmount, setCustomReminderAmount] = useState("");
  const [customReminderUnit, setCustomReminderUnit] = useState<ReminderUnit>("분");
  const [reminderError, setReminderError] = useState("");
  const [reminderUnitHintOpen, setReminderUnitHintOpen] = useState(false);
  const [reminderUnitHintSeen, setReminderUnitHintSeen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);
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
    const [startDate, endDate] = [calendarDragStart, calendarDragEnd].sort();
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
      openAddDialog(startDate);
      setEventEndDate(endDate === startDate ? "" : endDate);
      setDateSelectionMode(endDate === startDate ? "single" : "range");
    }
    setCalendarDragStart(null);
    setCalendarDragEnd(null);
  };

  const openAddDialog = (dateKey?: string) => {
    setEditingEventId(null);
    setEventTitle("");
    setEventDescription("");
    setContentMode("memo");
    setChecklistItems([]);
    setFocusedChecklistId(null);
    setEventStartTime("");
    setReminders([]);
    setReminderPickerOpen(false);
    setReminderPickerMode("quick");
    setCustomReminderAmount("");
    setCustomReminderUnit("일");
    setReminderError("");
    setEventDate(dateKey ?? selectedDate ?? todayKey);
    setEventEndDate("");
    setDateSelectionMode("single");
    setIsAddOpen(true);
  };

  const editSelectedEvent = () => {
    if (!selectedEvent) return;
    setEditingEventId(selectedEvent.id);
    setEventTitle(selectedEvent.title);
    setEventDate(selectedEvent.date);
    setEventEndDate(selectedEvent.endDate ?? "");
    setDateSelectionMode(selectedEvent.endDate ? "range" : "single");
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

  const deleteSelectedEvent = () => {
    if (!selectedEvent) return;
    setEvents((current) => current.filter((calendarEvent) => calendarEvent.id !== selectedEvent.id));
    setSelectedEvent(null);
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

  const saveEvent = () => {
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

    const nextEvent: CalendarEvent = {
      id: editingEventId ?? Date.now(),
      title,
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
    setEvents((current) => {
      if (editingEventId === null) return [...current, nextEvent];
      return current.map((calendarEvent) =>
        calendarEvent.id === editingEventId ? nextEvent : calendarEvent,
      );
    });
    const [eventYear, eventMonth] = eventDate.split("-").map(Number);
    if (
      Number.isInteger(eventYear) &&
      Number.isInteger(eventMonth) &&
      (eventYear !== year || eventMonth - 1 !== month)
    ) {
      setVisibleMonth(new Date(eventYear, eventMonth - 1, 1));
    }
    setSelectedDate(eventDate);
    setEditingEventId(null);
    setIsAddOpen(false);
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="이전 달"
            onClick={() => moveMonth(-1)}
            className="size-[42px] rounded-[12px] text-ink-muted hover:bg-item-hover hover:text-ink"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="다음 달"
            onClick={() => moveMonth(1)}
            className="size-[42px] rounded-[12px] text-ink-muted hover:bg-item-hover hover:text-ink"
          >
            <ChevronRight aria-hidden="true" className="size-5" />
          </Button>
          <div className="flex h-[42px] items-center rounded-[12px] border border-field-border bg-surface px-4 text-[15px] font-semibold text-ink">
            {year}년 {month + 1}월
          </div>
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
                const dayEvents = day.isCurrentMonth
                  ? [...(eventsByDate[day.key] ?? [])].sort(
                      (a, b) =>
                        getEventDurationDays(b) - getEventDurationDays(a) ||
                        a.date.localeCompare(b.date) ||
                        a.id - b.id,
                    )
                  : [];
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
                const visibleSingleCount = Math.min(
                  2,
                  Math.max(0, visibleRowLimit - periodLaneCount),
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
                      openAddDialog(day.key);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openAddDialog(day.key);
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
                        to="/calendar/growth-journal"
                        onClick={(event) => event.stopPropagation()}
                        className="group/journal invisible flex h-6 items-center gap-0.5 rounded-[6px] bg-item-hover px-1.5 py-0.5 text-[13px] font-medium text-ink-muted group-hover:visible hover:bg-calendar-journal-hover hover:text-brand"
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
                            ? { paddingTop: String(periodLaneCountByDate[day.key] * 24) + "px" }
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
                            className="h-[22px] w-full truncate rounded-[6px] bg-item-hover px-2 text-left text-xs font-normal hover:bg-item-hover-selected"
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
                          onMouseEnter={() => setHoveredPeriodEventId(segment.event.id)}
                          onMouseLeave={() => setHoveredPeriodEventId(null)}
                          className={cn(
                            "pointer-events-auto z-10 flex items-center truncate px-2 text-xs font-normal transition-colors",
                            hoveredPeriodEventId === segment.event.id
                              ? "bg-item-hover-selected"
                              : "bg-pill",
                            segment.isStart && "rounded-l-[6px]",
                            segment.isEnd && "rounded-r-[6px]",
                            "text-pill-foreground",
                          )}
                          style={{
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
                            "pointer-events-none z-20 flex items-center truncate bg-pill px-2 text-xs font-normal text-pill-foreground shadow-[0_4px_10px_0_rgba(22,59,49,0.18)]",
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
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) closeReminderPicker();
        }}
      >
        <DialogContent
          overlayClassName="bg-page"
          closeClassName="right-8 top-8 flex size-6 items-center justify-center rounded-none text-ink opacity-100 hover:opacity-100 focus:ring-0 focus:ring-offset-0 [&_svg]:size-6"
          className="flex h-[min(936px,calc(100vh-40px))] max-h-[936px] w-[592px] max-w-[calc(100vw-40px)] flex-col gap-0 rounded-[20px] border-0 bg-surface p-8 text-ink shadow-surface-card"
        >
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              saveEvent();
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
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-[18px] border-field-border bg-surface px-4 text-[14px] font-normal text-guide-text shadow-none hover:bg-item-hover hover:text-guide-text focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft"
            >
              지원사업 선택
              <ChevronDown aria-hidden="true" className="size-4 text-ink-muted" />
            </Button>

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
                          <div className="flex items-start gap-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="빠른 알림으로 돌아가기"
                              onClick={() => {
                                setReminderError("");
                                setReminderPickerMode("quick");
                              }}
                              className="-ml-1 h-6 w-5 shrink-0 rounded-[5px] p-0 text-ink-muted hover:bg-item-hover hover:text-ink focus-visible:outline-none focus-visible:ring-[3.2px] focus-visible:ring-focus-soft"
                            >
                              <ChevronLeft aria-hidden="true" className="size-4 -translate-y-1.5" />
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
                            <span aria-hidden="true" className="h-full w-px shrink-0 bg-field-border" />
                            {availableReminderUnits.length <= 1 ? (
                              <span className="flex h-full w-[54px] shrink-0 items-center justify-center bg-item-hover text-[14px] text-icon-muted">
                                일
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
                                    setCustomReminderUnit(availableReminderUnits[nextIndex].label);
                                    dismissReminderUnitHint();
                                  }}
                                  className="h-full w-[72px] shrink-0 cursor-pointer border-0 bg-surface px-2 text-center text-[14px] text-ink outline-none disabled:cursor-default"
                                >
                                  {customReminderUnit}
                                </button>
                              </TooltipTrigger>
                              {availableReminderUnits.length > 1 ? (
                                <TooltipContent
                                  side="bottom"
                                  sideOffset={6}
                                  className="rounded-[6px] bg-[#434343] px-2 py-1.5 text-[12px] font-medium leading-[18px] text-white shadow-none"
                                >
                                  클릭으로 전환
                                </TooltipContent>
                              ) : null}
                            </Tooltip>
                            )}
                            <span
                              className={cn(
                                "flex h-full shrink-0 items-center justify-center bg-item-hover text-[14px] text-icon-muted",
                                availableReminderUnits.length <= 1 ? "w-[54px]" : "w-9",
                              )}
                            >
                              전
                            </span>
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
                    placeholderClassName="left-3.5 top-3 text-[15px] leading-5 text-guide-text"
                    className="h-[164px] resize-none rounded-[12px] border-field-border px-3.5 py-3 pb-3 text-[15px] leading-5 md:text-[15px] text-ink shadow-none focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft"
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
              disabled={!eventTitle.trim() || !eventDate}
              className="h-12 w-[119px] rounded-[12px] bg-brand text-[16px] font-semibold text-brand-foreground shadow-none hover:bg-brand/88 active:bg-brand-pressed disabled:bg-brand-disabled disabled:opacity-100"
            >
              저장하기
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
          closeClassName="right-8 top-8 flex size-6 items-center justify-center rounded-none text-ink-muted opacity-100 hover:opacity-100 focus:ring-0 focus:ring-offset-0 [&_svg]:size-6"
          className="rounded-[12px] border-0 bg-surface pb-8 text-ink shadow-[0_12px_16px_0_rgba(9,31,23,0.12)] sm:max-w-[460px]"
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-ink">
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

      <Dialog open={selectedEvent !== null} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent
          closeClassName="right-8 top-4 flex size-9 items-center justify-center rounded-none text-ink-muted opacity-100 hover:opacity-100 focus:ring-0 focus:ring-offset-0 [&_svg]:size-6"
          className="rounded-[12px] border-0 bg-surface text-ink shadow-[0_12px_16px_0_rgba(9,31,23,0.12)] sm:max-w-[460px]"
        >
          <div className="absolute right-16 top-4 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="일정 수정"
              onClick={editSelectedEvent}
              className="size-9 rounded-[8px] text-ink-muted hover:bg-item-hover hover:text-ink"
            >
              <Pencil aria-hidden="true" className="size-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="일정 삭제"
              onClick={deleteSelectedEvent}
              className="size-9 rounded-[8px] text-ink-muted hover:bg-item-hover hover:text-ink"
            >
              <Trash2 aria-hidden="true" className="size-5" />
            </Button>
          </div>
          <DialogHeader>
            <DialogTitle className="pr-24 text-xl font-bold text-ink">
              {selectedEvent?.title}
            </DialogTitle>
            <DialogDescription className="text-sm font-semibold text-brand">
              {selectedEvent
                ? selectedEvent.endDate
                  ? `${formatKoreanDate(selectedEvent.date)} ~ ${formatKoreanDate(selectedEvent.endDate)}`
                  : formatKoreanDate(selectedEvent.date)
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-16 space-y-3">
            {selectedEvent?.description ? (
              <p className="whitespace-pre-wrap text-sm leading-6 text-ink-muted">
                {selectedEvent.description}
              </p>
            ) : null}
            {selectedEvent?.checklistItems?.length ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink">체크리스트</span>
                  <span className="text-ink-muted">
                    {selectedEvent.checklistItems.filter((item) => item.completed).length}/
                    {selectedEvent.checklistItems.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {selectedEvent.checklistItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
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
                    </div>
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
    </section>
  );
}
