import { createServerFn } from "@tanstack/react-start";

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
  .validator(validateInput)
  .handler(async ({ data }) => {
    const webhookUrl = process.env["N8N_CALENDAR_EVENTS_WEBHOOK_URL"];
    if (!webhookUrl) throw new Error("서버 캘린더 조회 URL이 설정되지 않았습니다.");

    const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    if (!supabaseUrl || !publishableKey) throw new Error("서버 Supabase 환경변수가 설정되지 않았습니다.");

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(data.accessToken);
    if (userError || !userData.user) throw new Error("로그인이 필요합니다.");

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userData.user.id }),
    });
    if (!response.ok) throw new Error(`캘린더를 불러오지 못했어요. (웹훅 ${response.status})`);

    const payload = (await response.json()) as { events?: unknown };
    return { events: Array.isArray(payload.events) ? payload.events : [] };
  });
