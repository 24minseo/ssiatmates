import { createServerFn } from "@tanstack/react-start";
import { callCalendarRpc, isRecord, requireToken } from "./calendarApiTransport";
export const createCalendarTask = createServerFn({ method: "POST" }).validator((input: unknown) => {
  if (!isRecord(input) || typeof input.title !== "string" || !input.title.trim() || typeof input.date !== "string") throw new Error("일정 제목과 날짜를 확인해주세요.");
  return { ...input, accessToken: requireToken(input.accessToken) } as any;
}).handler(async ({ data }) => {
  const { accessToken, client_request_id, ...input } = data;
  const clientRequestId = client_request_id || crypto.randomUUID();
  return callCalendarRpc("manage_my_calendar_task_v3", { p_action: "create", p_input: input, p_client_request_id: clientRequestId }, accessToken, "N8N_CALENDAR_TASK_WEBHOOK_URL", { ...input, client_request_id: clientRequestId });
});
