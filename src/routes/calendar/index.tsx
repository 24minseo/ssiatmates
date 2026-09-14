import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar/")({
  head: () => ({
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
type ContentMode = "memo" | "checklist";

type ChecklistItem = {
  id: number;
  text: string;
  completed: boolean;
};

type ChecklistDropPosition = "before" | "after";

type CalendarEvent = {
  id: number;
  title: string;
  date: string;
  description: string;
  contentMode?: ContentMode;
  checklistItems?: ChecklistItem[];
  startTime?: string;
  reminder?: boolean;
};

type CalendarDay = {
  date: Date;
  key: string;
  isCurrentMonth: boolean;
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
  const [eventDescription, setEventDescription] = useState("");
  const [contentMode, setContentMode] = useState<ContentMode>("memo");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [focusedChecklistId, setFocusedChecklistId] = useState<number | null>(null);
  const [draggingChecklistId, setDraggingChecklistId] = useState<number | null>(null);
  const [dragOverChecklistId, setDragOverChecklistId] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<ChecklistDropPosition>("before");
  const [checklistHandleTop, setChecklistHandleTop] = useState<number | null>(null);
  const [checklistGhostTop, setChecklistGhostTop] = useState<number | null>(null);
  const [eventStartTime, setEventStartTime] = useState("");
  const [hasReminder, setHasReminder] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const days = useMemo(() => buildCalendarDays(year, month), [year, month]);
  const eventsByDate = useMemo(() => {
    return events.reduce<Record<string, CalendarEvent[]>>((grouped, event) => {
      grouped[event.date] = [...(grouped[event.date] ?? []), event];
      return grouped;
    }, {});
  }, [events]);
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.date.localeCompare(b.date)),
    [events],
  );
  const draggingChecklistItem = checklistItems.find((item) => item.id === draggingChecklistId) ?? null;

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const goToToday = () => {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(todayKey);
  };

  const openAddDialog = (dateKey?: string) => {
    setEditingEventId(null);
    setEventTitle("");
    setEventDescription("");
    setContentMode("memo");
    setChecklistItems([]);
    setFocusedChecklistId(null);
    setEventStartTime("");
    setHasReminder(false);
    setEventDate(dateKey ?? selectedDate ?? todayKey);
    setIsAddOpen(true);
  };

  const editSelectedEvent = () => {
    if (!selectedEvent) return;
    setEditingEventId(selectedEvent.id);
    setEventTitle(selectedEvent.title);
    setEventDate(selectedEvent.date);
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
    setHasReminder(selectedEvent.reminder ?? false);
    setSelectedEvent(null);
    setIsAddOpen(true);
  };

  const deleteSelectedEvent = () => {
    if (!selectedEvent) return;
    setEvents((current) => current.filter((calendarEvent) => calendarEvent.id !== selectedEvent.id));
    setSelectedEvent(null);
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

  const addChecklistItem = () => {
    if (checklistItems.length >= CHECKLIST_MAX_ITEMS) return;
    const nextItem = createChecklistItem();
    setChecklistItems((current) => [...current, nextItem]);
    setFocusedChecklistId(nextItem.id);
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
    setChecklistItems((current) => current.filter((item) => item.id !== id));
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

    const nextEvent: CalendarEvent = {
      id: editingEventId ?? Date.now(),
      title,
      date: eventDate,
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
      reminder: hasReminder,
    };
    setEvents((current) => {
      if (editingEventId === null) return [...current, nextEvent];
      return current.map((calendarEvent) =>
        calendarEvent.id === editingEventId ? nextEvent : calendarEvent,
      );
    });
    setVisibleMonth(() => {
      const [eventYear, eventMonth] = eventDate.split("-").map(Number);
      if (eventYear === undefined || eventMonth === undefined) return visibleMonth;
      return new Date(eventYear, eventMonth - 1, 1);
    });
    setSelectedDate(eventDate);
    setEditingEventId(null);
    setIsAddOpen(false);
  };


  const startChecklistPointerDrag = (
    item: ChecklistItem,
    index: number,
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

      targetId = Number(targetRow.dataset.checklistId);
      const bounds = targetRow.getBoundingClientRect();
      targetPosition = clientY < bounds.top + bounds.height / 2 ? "before" : "after";
      setDragOverChecklistId(targetId);
      setDragOverPosition(targetPosition);
      setChecklistHandleTop(targetRow.offsetTop + 10);
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
      setChecklistHandleTop(null);
    };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      moveEvent.preventDefault();
      updateDragPosition(moveEvent.clientY);
    };

    setDraggingChecklistId(item.id);
    setChecklistGhostTop(Math.max(0, row.offsetTop));
    setChecklistHandleTop(row.offsetTop + 10);
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
        <div className="mt-4 flex h-[675px] flex-col overflow-hidden rounded-[12px] border border-field-border bg-surface">
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
          <div className="grid min-h-0 flex-1 grid-cols-7 auto-rows-fr" role="grid" aria-label={`${year}년 ${month + 1}월`}>
            {days.map((day, index) => {
              const isSelected = selectedDate === day.key;
              const isToday = todayKey === day.key;
              const dayEvents = day.isCurrentMonth ? (eventsByDate[day.key] ?? []) : [];

              return (
                <div
                  key={day.key}
                  role="gridcell"
                  tabIndex={0}
                  aria-selected={isSelected}
                  aria-label={`${formatKoreanDate(day.key)}${isToday ? ", 오늘" : ""}`}
                  onClick={() => openAddDialog(day.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openAddDialog(day.key);
                    }
                  }}
                  className={cn(
                    "group relative h-full min-w-0 cursor-pointer overflow-hidden bg-surface p-2 text-ink hover:bg-item-hover",
                    index < days.length - 7 && "border-b border-field-border",
                  )}
                >
                  <div className="flex h-6 items-start justify-between gap-2">
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-[6px] text-sm font-normal leading-4",
                        !day.isCurrentMonth && "text-content-disabled",
                        day.isCurrentMonth && !isToday && !isSelected && "text-ink",
                        isToday && "bg-brand text-brand-foreground",
                      )}
                    >
                      {day.date.getDate()}
                    </span>
                    <Link
                      to="/calendar/growth-journal"
                      onClick={(event) => event.stopPropagation()}
                      className="group/journal invisible flex h-6 items-center gap-1 rounded-[6px] bg-field-border/70 px-1.5 text-[13px] font-normal text-ink-muted group-hover:visible hover:bg-field-border hover:text-brand"
                    >
                      <img src="/assets/sidebar/journal-edit-default.svg" alt="" aria-hidden="true" className="h-[18px] w-3.5 object-contain group-hover/journal:hidden" />
                      <img src="/assets/sidebar/journal-edit-hover.svg" alt="" aria-hidden="true" className="hidden h-[18px] w-3.5 object-contain group-hover/journal:block" />
                      일지 쓰기
                    </Link>
                  </div>

                  {dayEvents.length > 0 ? (
                    <div className="mt-1.5 flex min-w-0 flex-col gap-1">
                      {dayEvents.slice(0, 2).map((calendarEvent) => (
                        <button
                          key={calendarEvent.id}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedEvent(calendarEvent);
                          }}
                          className="h-6 w-full truncate rounded-[6px] bg-menu-hover px-2 text-left text-xs font-normal text-ink hover:bg-item-hover-selected"
                        >
                          {calendarEvent.title}
                        </button>
                      ))}
                      {dayEvents.length > 2 ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedDayEvents({ date: day.key, events: dayEvents });
                          }}
                          className="h-6 w-full truncate rounded-[6px] px-2 text-left text-xs font-normal text-ink-muted hover:bg-item-hover hover:underline"
                        >
                          {dayEvents.length - 2}개 더보기
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
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

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent
          overlayClassName="bg-page"
          closeClassName="right-8 top-8 flex size-6 items-center justify-center rounded-none text-ink opacity-100 hover:opacity-100 focus:ring-0 focus:ring-offset-0 [&_svg]:size-5"
          className="flex h-[min(936px,calc(100vh-40px))] max-h-[936px] w-[592px] max-w-[calc(100vw-40px)] flex-col gap-0 rounded-[20px] border-0 bg-surface p-8 text-ink shadow-surface-card"
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
                <Label htmlFor="todo-date" className="text-sm font-semibold text-ink">날짜</Label>
                <div className="relative">
                  <Input
                    id="todo-date"
                    type="date"
                    value={eventDate}
                    onChange={(event) => setEventDate(event.target.value)}
                    className="h-12 rounded-[12px] border-field-border px-3.5 pr-10 text-[15px] md:text-[15px] text-ink shadow-none focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                  />
                  <CalendarDays aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 size-[18px] -translate-y-1/2 text-guide-text" />
                </div>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="todo-time" className="text-sm font-semibold text-ink">시작 시간</Label>
                <div className="relative">
                  <Input
                    id="todo-time"
                    type="time"
                    value={eventStartTime}
                    onChange={(event) => setEventStartTime(event.target.value)}
                    placeholder="시작 시간 선택"
                    className={cn(
                      "h-12 rounded-[12px] border-field-border px-3.5 pr-10 text-[15px] md:text-[15px] text-ink shadow-none focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0",
                      !eventStartTime && "text-transparent placeholder:text-transparent caret-[#1F8064]",
                    )}
                  />
                  {!eventStartTime ? (
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-guide-text">
                      시작 시간 선택
                    </span>
                  ) : null}
                  <Clock3 aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 size-[18px] -translate-y-1/2 text-guide-text" />
                </div>
              </div>
            </div>

            <fieldset className="mt-[18px]">
              <legend className="text-sm font-semibold text-ink">알림</legend>
              <div className="mt-2 flex h-9 items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-[18px] bg-item-hover px-4 text-[14px] font-normal",
                    hasReminder ? "text-icon-muted" : "text-ink-muted",
                  )}
                >
                  {hasReminder ? <Bell aria-hidden="true" className="size-3.5" /> : null}
                  {hasReminder ? "10분 전" : "알림 없음"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setHasReminder((current) => !current)}
                  className="h-9 rounded-[8px] px-2 text-[14px] font-normal text-ink-muted hover:bg-item-hover hover:text-ink"
                >
                  <Plus aria-hidden="true" className="size-4" />
                  {hasReminder ? "알림 제거" : "알림 추가"}
                </Button>
              </div>
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
                  <Textarea
                    id="todo-description"
                    value={eventDescription}
                    onChange={(event) => setEventDescription(event.target.value)}
                    maxLength={500}
                    placeholder="메모할 내용이 있으면 적어주세요."
                    className="h-[164px] resize-none rounded-[12px] border-field-border px-3.5 py-3 pb-3 text-[15px] md:text-[15px] text-ink shadow-none placeholder:text-guide-text focus-visible:border-brand focus-visible:ring-[3.2px] focus-visible:ring-focus-soft"
                  />
                  <span
                    aria-live="polite"
                    className="pointer-events-none absolute bottom-2 right-2 inline-flex rounded-[4px] bg-surface px-2 py-1 text-[12px] leading-3 text-icon-muted"
                  >
                    <span className={eventDescription.length > 0 ? "text-ink" : "text-icon-muted"}>{eventDescription.length}</span>/500
                  </span>
                </div>
              ) : (
                <div className="mt-1 rounded-[12px] bg-surface py-2.5 pl-0 pr-2.5">
                  <div className="group/checklist-list relative flex flex-col gap-0" onMouseLeave={() => setChecklistHandleTop(null)}>
                    <span aria-hidden="true" className="pointer-events-none absolute bottom-3 left-0.5 top-2.5 z-0 w-0.5 rounded-full bg-field-border/70" />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none absolute left-0.5 z-10 h-[18px] w-0.5 rounded-full bg-icon-muted duration-150 ease-out group-hover/checklist-list:w-[3px]",
                        draggingChecklistId !== null
                          ? "transition-[top,opacity,width]"
                          : "transition-[opacity,width]",
                      )}
                      style={{ top: checklistHandleTop ?? 0, opacity: checklistHandleTop === null ? 0 : 1 }}
                    />
                    {draggingChecklistItem && checklistGhostTop !== null ? (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute left-6 right-2 z-20 flex h-10 items-start gap-2 pt-2.5 opacity-80"
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
                            setChecklistHandleTop(event.currentTarget.offsetTop + 10);
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setChecklistHandleTop(event.currentTarget.offsetTop + 10);
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
                            onPointerDown={(event) => startChecklistPointerDrag(item, index, event)}
                            className="pointer-events-none relative z-10 col-start-1 mt-0 h-8 w-6 shrink-0 cursor-grab rounded-[8px] text-icon-muted opacity-0 shadow-none transition-opacity active:cursor-grabbing group-hover/checklist-row:pointer-events-auto group-hover/checklist-row:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 hover:bg-transparent hover:text-icon-muted"
                          />
                          <Checkbox
                            checked={item.completed}
                            aria-label={item.completed ? `항목 ${index + 1} 완료 취소` : `항목 ${index + 1} 완료`}
                            onCheckedChange={() => toggleChecklistItem(item.id)}
                            className="mt-1.5 size-[18px] shrink-0 rounded-[5px] border-field-border [&_svg]:size-3 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-brand-foreground"
                          />
                          <div className="relative min-w-0 flex-1">
                            <Textarea
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
                                event.preventDefault();
                                addChecklistItemAfter(item.id);
                              }}
                              onChange={(event) => updateChecklistItem(item.id, event.target.value)}
                              placeholder={`항목 ${index + 1}`}
                              className={cn(
                                "h-8 !min-h-8 max-h-16 resize-none overflow-y-auto rounded-none border border-transparent bg-transparent px-0 py-1 text-[15px] md:text-[15px] leading-5 text-ink shadow-none placeholder:text-guide-text focus-visible:border-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-focus-soft",
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

                  {checklistItems.length < CHECKLIST_MAX_ITEMS ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={addChecklistItem}
                      className="mt-1 ml-[60px] h-8 rounded-[8px] px-2 text-[13px] font-normal text-brand shadow-none hover:bg-transparent hover:text-brand hover:underline"
                    >
                      <Plus aria-hidden="true" className="size-4" />
                      항목 추가
                    </Button>
                  ) : (
                    <p className="mt-2 px-2 text-[12px] text-icon-muted">
                      최대 {CHECKLIST_MAX_ITEMS}개까지 추가할 수 있어요.
                    </p>
                  )}
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
              type="button"
              disabled={!eventTitle.trim() || !eventDate}
              onClick={saveEvent}
              className="h-12 w-[119px] rounded-[12px] bg-brand text-[16px] font-semibold text-brand-foreground shadow-none hover:bg-brand/88 active:bg-brand-pressed disabled:bg-brand-disabled disabled:opacity-100"
            >
              저장하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedDayEvents !== null}
        onOpenChange={(open) => !open && setSelectedDayEvents(null)}
      >
        <DialogContent className="rounded-[12px] border-0 bg-surface text-ink shadow-[0_12px_16px_0_rgba(9,31,23,0.12)] sm:max-w-[460px]">
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
        <DialogContent className="rounded-[12px] border-0 bg-surface text-ink shadow-[0_12px_16px_0_rgba(9,31,23,0.12)] sm:max-w-[460px]">
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
              {selectedEvent ? formatKoreanDate(selectedEvent.date) : ""}
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
