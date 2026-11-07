import { createServerFn } from "@tanstack/react-start";
import { callCalendarRpc, isRecord, requireToken } from "./calendarApiTransport";
export const mutateCalendarEvent = createServerFn({ method: "POST" }).validator((input: unknown) => {
  if (!isRecord(input) || !["update", "delete", "complete", "reopen", "toggle_checklist"].includes(String(input.action))) throw new Error("일정 작업을 확인해주세요.");
  return { ...input, accessToken: requireToken(input.accessToken) } as any;
}).handler(async ({ data }) => {
  const { accessToken, action, eventId, title, startDate, endDate, dateMode, color, allDay, itemId } = data;
  const patch = action === "update" ? {
    title,
    date: startDate,
    end_date: endDate && endDate !== startDate ? endDate : null,
    date_mode: dateMode ?? (endDate && endDate !== startDate ? "range" : "single"),
    color,
  } : action === "toggle_checklist" ? { item_id: itemId } : {};
  return callCalendarRpc("manage_my_calendar_task_v3", { p_action: action, p_event_id: eventId, p_input: patch, p_expected_updated_at: data.expectedUpdatedAt ?? null }, accessToken, "N8N_CALENDAR_EVENT_MUTATION_WEBHOOK_URL", { event_id: eventId, action, patch, expected_updated_at: data.expectedUpdatedAt ?? null });
});
