import { createServerFn } from "@tanstack/react-start";

type CalendarEventMutationInput = {
  userId: string;
  eventId: string | number;
  action: "update" | "delete";
  title?: string;
  startDate?: string;
  endDate?: string;
  color?: string;
  allDay?: boolean;
  accessToken: string;
};

function validateInput(input: unknown): CalendarEventMutationInput {
  if (typeof input !== "object" || input === null) throw new Error("일정 정보를 확인해주세요.");
  const value = input as Record<string, unknown>;
  if (
    typeof value.userId !== "string" || !value.userId.trim() ||
    (typeof value.eventId !== "string" && typeof value.eventId !== "number") ||
    (value.action !== "update" && value.action !== "delete") ||
    typeof value.accessToken !== "string" || !value.accessToken.trim()
  ) throw new Error("일정 정보를 확인해주세요.");
  return {
    userId: value.userId,
    eventId: value.eventId,
    action: value.action,
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    ...(typeof value.startDate === "string" ? { startDate: value.startDate } : {}),
    ...(typeof value.endDate === "string" ? { endDate: value.endDate } : {}),
    ...(typeof value.color === "string" ? { color: value.color } : {}),
    ...(typeof value.allDay === "boolean" ? { allDay: value.allDay } : {}),
    accessToken: value.accessToken,
  };
}

export const mutateCalendarEvent = createServerFn({ method: "POST" })
  .validator(validateInput)
  .handler(async ({ data }) => {
    const webhookUrl = process.env["N8N_CALENDAR_EVENT_MUTATION_WEBHOOK_URL"];
    if (!webhookUrl) throw new Error("서버 일정 수정 URL이 설정되지 않았습니다.");
    const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    if (!supabaseUrl || !publishableKey) throw new Error("서버 Supabase 환경변수가 설정되지 않았습니다.");
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(data.accessToken);
    if (userError || !userData.user || userData.user.id !== data.userId) throw new Error("로그인이 필요합니다.");
    const body: Record<string, unknown> = {
      user_id: data.userId,
      event_id: data.eventId,
      action: data.action,
    };
    if (data.action === "update") {
      body.title = data.title;
      body.start_date = data.startDate;
      body.end_date = data.endDate;
      body.color = data.color;
      body.all_day = data.allDay;
    }
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`일정을 처리하지 못했어요. (웹훅 ${response.status})`);
    return { success: true };
  });
