import { createServerFn } from "@tanstack/react-start";
import { callCalendarRpc, isRecord, requireToken } from "./calendarApiTransport";

type CalendarEventsInput = { accessToken: string };

function validateInput(input: unknown): CalendarEventsInput {
  if (typeof input !== "object" || input === null) {
    throw new Error("캘린더 조회 정보를 확인해주세요.");
  }
  const value = input as Record<string, unknown>;
  if (typeof value["accessToken"] !== "string" || !value["accessToken"].trim()) {
    throw new Error("로그인이 필요합니다.");
  }
  return { accessToken: value["accessToken"] };
}

export const getCalendarEvents = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!isRecord(input)) throw new Error("캘린더 조회 정보를 확인해주세요.");
    return { accessToken: requireToken(input.accessToken) };
  })
  .handler(async ({ data }) => {
    const result = await callCalendarRpc(
      "get_my_calendar_events_v3", {}, data.accessToken,
      "N8N_CALENDAR_EVENTS_WEBHOOK_URL", {},
    );
    if (!Array.isArray(result.events)) throw new Error("캘린더 조회 응답을 확인할 수 없어요.");
    return { events: result.events };
  });
