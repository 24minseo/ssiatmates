import { createServerFn } from "@tanstack/react-start";
import { callCalendarRpc, isRecord, requireToken } from "./calendarApiTransport";
export const mutateCalendarEvent = createServerFn({ method: "POST" }).validator((input: unknown) => {
  if (!isRecord(input) || !["update", "delete", "complete", "reopen", "toggle_checklist"].includes(String(input.action))) throw new Error("일정 작업을 확인해주세요.");
  return { ...input, accessToken: requireToken(input.accessToken) } as any;
}).handler(async ({ data }) => {
  const { accessToken, action, eventId, title, startDate, endDate, dateMode, color, allDay, itemId } = data;
  const mode = dateMode ?? (endDate && endDate !== startDate ? "range" : "single");
  const patch = action === "update" ? {
    title,
    date: startDate,
    ...(dateMode !== undefined || startDate !== undefined || endDate !== undefined
      ? { date_mode: mode, end_date: mode === "range" ? endDate ?? null : null }
      : {}),
    color,
    ...(data.startTime !== undefined ? { start_time: data.startTime } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.contentMode !== undefined ? { content_mode: data.contentMode } : {}),
    ...(data.checklistItems !== undefined ? { checklist_items: data.checklistItems } : {}),
    ...(data.reminders !== undefined ? { reminders: data.reminders } : {}),
    ...(data.savedNoticeId !== undefined ? { saved_notice_id: data.savedNoticeId } : {}),
    ...(data.linkedNotice !== undefined ? { linked_notice: data.linkedNotice } : {}),
  } : action === "toggle_checklist" ? { item_id: itemId } : {};
  return callCalendarRpc("manage_my_calendar_task_v3", { p_action: action, p_event_id: eventId, p_input: patch, p_expected_updated_at: data.expectedUpdatedAt ?? null }, accessToken, "N8N_CALENDAR_EVENT_MUTATION_WEBHOOK_URL", { event_id: eventId, action, patch, expected_updated_at: data.expectedUpdatedAt ?? null });
});
