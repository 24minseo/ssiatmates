import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

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

type CalendarEvent = {
  id: number;
  title: string;
  date: string;
  description: string;
};

type CalendarDay = {
  date: Date;
  key: string;
  isCurrentMonth: boolean;
};

const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"] as const;

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
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: string; events: CalendarEvent[] } | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventDescription, setEventDescription] = useState("");

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

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const goToToday = () => {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(todayKey);
  };

  const openAddDialog = (dateKey?: string) => {
    setEventTitle("");
    setEventDescription("");
    setEventDate(dateKey ?? selectedDate ?? todayKey);
    setIsAddOpen(true);
  };

  const saveEvent = () => {
    const title = eventTitle.trim();
    if (!title || !eventDate) return;

    setEvents((current) => [
      ...current,
      {
        id: Date.now(),
        title,
        date: eventDate,
        description: eventDescription.trim(),
      },
    ]);
    setVisibleMonth(() => {
      const [eventYear, eventMonth] = eventDate.split("-").map(Number);
      return new Date(eventYear, eventMonth - 1, 1);
    });
    setSelectedDate(eventDate);
    setIsAddOpen(false);
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
                "absolute top-1/2 h-8 -translate-y-1/2 rounded-[8px] bg-surface shadow-[0_2px_6px_0_rgba(85,113,78,0.1)] transition-[left,width] duration-150 ease-out motion-reduce:transition-none",
                view === "month"
                  ? "left-[5px] w-11"
                  : "left-[52px] w-14",
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
                      "relative shrink-0 px-[10px] py-[6px] text-[13px] font-medium leading-[normal] transition-colors duration-150 motion-reduce:transition-none hover:bg-transparent",
                      selected
                        ? monthOption
                          ? "h-8 w-11 rounded-[12px] text-ink hover:text-ink"
                          : "h-8 w-14 rounded-[6px] text-ink hover:text-ink"
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
                className="flex items-center px-2 text-xs font-semibold text-ink-muted"
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
                        "flex size-6 shrink-0 items-center justify-center rounded-[6px] text-sm font-medium leading-4",
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
                      className="group/journal invisible flex h-6 items-center gap-1 rounded-[6px] bg-field-border/70 px-1.5 text-[13px] font-medium text-ink-muted group-hover:visible hover:bg-field-border hover:text-brand"
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
                          className="h-6 w-full truncate rounded-[6px] bg-menu-hover px-2 text-left text-xs font-medium text-ink hover:bg-item-hover-selected"
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
                          className="h-6 w-full truncate rounded-[6px] px-2 text-left text-xs font-medium text-ink-muted hover:bg-item-hover"
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
          overlayClassName="bg-[#9EA9AE]/50"
          className="rounded-[12px] border-0 bg-surface text-ink sm:max-w-[460px]"
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-ink">할 일 추가</DialogTitle>
            <DialogDescription className="text-sm text-ink-muted">
              캘린더에 표시할 할 일을 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-2">
            <div className="grid gap-2">
              <Label htmlFor="todo-title" className="font-semibold text-ink">제목</Label>
              <Input
                id="todo-title"
                value={eventTitle}
                onChange={(event) => setEventTitle(event.target.value)}
                placeholder="할 일 제목"
                className="h-[42px] rounded-[12px] border-field-border text-ink placeholder:text-placeholder"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="todo-date" className="font-semibold text-ink">날짜</Label>
              <Input
                id="todo-date"
                type="date"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
                className="h-[42px] rounded-[12px] border-field-border text-ink"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="todo-description" className="font-semibold text-ink">내용</Label>
              <Textarea
                id="todo-description"
                value={eventDescription}
                onChange={(event) => setEventDescription(event.target.value)}
                placeholder="상세 내용을 입력해주세요."
                className="min-h-24 resize-none rounded-[12px] border-field-border text-ink placeholder:text-placeholder"
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:space-x-0">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddOpen(false)}
              className="h-[42px] flex-1 rounded-[12px] bg-secondary-btn text-secondary-btn-text hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover"
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={!eventTitle.trim() || !eventDate}
              onClick={saveEvent}
              className="h-[42px] flex-1 rounded-[12px] bg-brand text-[15px] font-semibold text-brand-foreground hover:bg-brand/88 active:bg-brand-pressed disabled:bg-brand-disabled disabled:opacity-100"
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedDayEvents !== null}
        onOpenChange={(open) => !open && setSelectedDayEvents(null)}
      >
        <DialogContent className="rounded-[12px] border-0 bg-surface text-ink sm:max-w-[460px]">
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
                className="h-10 w-full truncate rounded-[8px] bg-menu-hover px-3 text-left text-sm font-medium text-ink hover:bg-item-hover-selected"
              >
                {calendarEvent.title}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedEvent !== null} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="rounded-[12px] border-0 bg-surface text-ink sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="pr-8 text-xl font-bold text-ink">
              {selectedEvent?.title}
            </DialogTitle>
            <DialogDescription className="text-sm font-semibold text-brand">
              {selectedEvent ? formatKoreanDate(selectedEvent.date) : ""}
            </DialogDescription>
          </DialogHeader>
          <p className="min-h-16 whitespace-pre-wrap text-sm leading-6 text-ink-muted">
            {selectedEvent?.description || "등록된 상세 내용이 없습니다."}
          </p>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="h-[42px] rounded-[12px] bg-brand px-6 font-semibold text-brand-foreground hover:bg-brand/88 active:bg-brand-pressed"
            >
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
