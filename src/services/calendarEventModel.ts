export type ChecklistItem = { id: number; text: string; completed: boolean };
export type CalendarUiEvent = {
  id: string | number;
  title: string;
  date: string;
  endDate?: string;
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

export function normalizeCalendarEvents(items: unknown): CalendarUiEvent[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((raw) => {
    const value = record(raw);
    if ((typeof value.id !== "string" && typeof value.id !== "number") || typeof value.title !== "string" || typeof value.start !== "string") return [];
    const date = value.start.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const props = record(value.extendedProps);
    const checklist = props.checklist_items;
    return [{
      id: value.id,
      title: value.title,
      date,
      ...(typeof value.end === "string" ? { endDate: value.end.slice(0, 10) } : {}),
      description: typeof props.description === "string" ? props.description : typeof value.description === "string" ? value.description : "",
      contentMode: props.content_mode === "checklist" ? "checklist" : "memo",
      checklistItems: Array.isArray(checklist) ? checklist.flatMap((item) => {
        const row = record(item);
        return typeof row.id === "number" && typeof row.text === "string" ? [{ id: row.id, text: row.text, completed: row.completed === true }] : [];
      }) : [],
      color: typeof value.color === "string" ? value.color : undefined,
      url: typeof value.url === "string" ? value.url : undefined,
      allDay: value.allDay !== false,
      editable: props.editable === true,
    } satisfies CalendarUiEvent];
  });
}
