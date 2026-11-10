export type ChecklistItem = { id: number; text: string; completed: boolean };
export type CalendarUiEvent = {
  id: string | number;
  title: string;
  date: string;
  endDate?: string;
  dateMode?: "single" | "range";
  description: string;
  contentMode?: "memo" | "checklist";
  checklistItems?: ChecklistItem[];
  startTime?: string;
  reminders?: string[];
  color?: string;
  url?: string;
  allDay?: boolean;
  editable?: boolean;
  savedNoticeId?: string | null;
  linkedNotice?: Record<string, unknown> | null;
  updatedAt?: string | null;
  completed?: boolean;
  eventType?: string;
};

const record = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};

function calendarDay(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) return undefined;
  const day = value.slice(0, 10);
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day ? day : undefined;
}

function shiftCalendarDay(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function normalizeCalendarEvents(items: unknown): CalendarUiEvent[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((raw) => {
    const value = record(raw);
    if ((typeof value.id !== "string" && typeof value.id !== "number") || typeof value.title !== "string" || typeof value.start !== "string") return [];
    const date = calendarDay(value.start);
    if (!date) return [];
    const props = record(value.extendedProps);
    const metadata = record(props.metadata ?? value.metadata);
    const linkedNotice = record(props.linked_notice ?? metadata.linked_notice ?? value.linked_notice);
    const eventType = typeof props.event_type === "string"
      ? props.event_type
      : typeof metadata.event_type === "string"
        ? metadata.event_type
        : typeof value.event_type === "string" ? value.event_type : "";
    // Keep the stored title so users can rename an automatic deadline event.
    // The backend supplies the default `[접수 마감일] ...` title when it is created.
    const displayTitle = value.title;
    const applicationMethod = typeof props.application_method === "string"
      ? props.application_method
      : typeof metadata.application_method === "string" ? metadata.application_method : "";
    const applicationMethodText = applicationMethod.includes("신청방법")
      ? applicationMethod.slice(applicationMethod.indexOf("신청방법") + "신청방법".length).replace(/^\s*[:：-]?\s*/, "").trim()
      : applicationMethod;
    const storedDocuments = (Array.isArray(props.submission_documents)
      ? props.submission_documents
      : Array.isArray(metadata.submission_documents) ? metadata.submission_documents : [])
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .flatMap((item) => item
        .split(/\r?\n+/)
        .map((line) => line.replace(/^\s*(?:[-•·▪◦]\s*|\d+[.)]\s*)/, "").trim())
        .filter((line) => line.length > 0 && !/^(?:없음|없습니다|해당\s*없음|해당\s*사항\s*없음)\.?$/i.test(line)));
    const end = calendarDay(value.end);
    const inclusiveEnd = calendarDay(props.end_inclusive) ??
      (end && props.end_exclusive !== false ? shiftCalendarDay(end, -1) : end) ??
      date;
    const storedMode = props.date_mode ?? metadata.date_mode;
    const dateMode = storedMode !== "single" && inclusiveEnd >= date &&
      (storedMode === "range" || inclusiveEnd > date) ? "range" : "single";
    const checklist = Array.isArray(props.checklist_items) && props.checklist_items.length > 0
      ? props.checklist_items
      : null;
    return [{
      id: value.id,
      title: displayTitle,
      date,
      ...(dateMode === "range" ? { endDate: inclusiveEnd } : {}),
      dateMode,
      description: typeof props.description === "string" && props.description.trim().length > 0
        ? props.description
        : typeof value.description === "string" && value.description.trim().length > 0 ? value.description
          : applicationMethodText,
      contentMode: props.content_mode === "checklist" || storedDocuments.length > 0 ? "checklist" : "memo",
      checklistItems: checklist ? checklist.flatMap((item) => {
        const row = record(item);
        return typeof row.id === "number" && typeof row.text === "string" ? [{ id: row.id, text: row.text, completed: row.completed === true }] : [];
      }) : storedDocuments.map((text, index) => ({ id: index + 1, text, completed: false })),
      startTime: typeof props.start_time === "string" ? props.start_time : typeof metadata.start_time === "string" ? metadata.start_time : typeof value.start_time === "string" ? value.start_time : eventType === "application_deadline" && typeof props.time_label === "string" ? props.time_label.match(/(\d{2}:\d{2})$/)?.[1] : typeof value.start === "string" && value.start.includes("T") ? value.start.slice(11, 16) : undefined,
      reminders: Array.isArray(props.reminders) ? props.reminders.filter((item): item is string => typeof item === "string") : Array.isArray(metadata.reminders) ? metadata.reminders.filter((item): item is string => typeof item === "string") : [],
      color: typeof value.color === "string" ? value.color : undefined,
      url: typeof value.url === "string" ? value.url : undefined,
      allDay: value.allDay !== false,
      editable: props.editable === true,
      savedNoticeId: typeof props.saved_notice_id === "string"
        ? props.saved_notice_id
        : typeof metadata.saved_notice_id === "string"
          ? metadata.saved_notice_id
          : typeof value.saved_notice_id === "string" ? value.saved_notice_id : null,
      linkedNotice,
      updatedAt: typeof props.updated_at === "string" ? props.updated_at : null,
      completed: props.is_completed === true,
      eventType,
    } satisfies CalendarUiEvent];
  });
}
export function upsertCalendarEvent(items: CalendarUiEvent[], next: CalendarUiEvent): CalendarUiEvent[] {
  return [...items.filter((item) => item.id !== next.id), next];
}
