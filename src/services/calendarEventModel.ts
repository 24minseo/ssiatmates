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
};

const record = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};

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
    const date = value.start.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const props = record(value.extendedProps);
    const metadata = record(props.metadata);
    const inclusiveEnd = typeof props.end_inclusive === "string"
      ? props.end_inclusive
      : typeof value.end === "string" ? shiftCalendarDay(value.end.slice(0, 10), -1) : date;
    const dateMode = props.date_mode === "range" || inclusiveEnd > date ? "range" : "single";
    const checklist = props.checklist_items;
    return [{
      id: value.id,
      title: value.title,
      date,
      ...(dateMode === "range" ? { endDate: inclusiveEnd } : {}),
      dateMode,
      description: typeof props.description === "string" ? props.description : typeof value.description === "string" ? value.description : "",
      contentMode: props.content_mode === "checklist" ? "checklist" : "memo",
      checklistItems: Array.isArray(checklist) ? checklist.flatMap((item) => {
        const row = record(item);
        return typeof row.id === "number" && typeof row.text === "string" ? [{ id: row.id, text: row.text, completed: row.completed === true }] : [];
      }) : [],
      startTime: typeof props.start_time === "string" ? props.start_time : typeof metadata.start_time === "string" ? metadata.start_time : typeof value.start_time === "string" ? value.start_time : undefined,
      reminders: Array.isArray(props.reminders) ? props.reminders.filter((item): item is string => typeof item === "string") : Array.isArray(metadata.reminders) ? metadata.reminders.filter((item): item is string => typeof item === "string") : [],
      color: typeof value.color === "string" ? value.color : undefined,
      url: typeof value.url === "string" ? value.url : undefined,
      allDay: value.allDay !== false,
      editable: props.editable === true,
      savedNoticeId: typeof props.saved_notice_id === "string" ? props.saved_notice_id : null,
      linkedNotice: record(props.linked_notice),
      updatedAt: typeof props.updated_at === "string" ? props.updated_at : null,
      completed: props.is_completed === true,
    } satisfies CalendarUiEvent];
  });
}
export function upsertCalendarEvent(items: CalendarUiEvent[], next: CalendarUiEvent): CalendarUiEvent[] {
  return [...items.filter((item) => item.id !== next.id), next];
}
