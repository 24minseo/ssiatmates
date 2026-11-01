import { createServerFn } from "@tanstack/react-start";

export type CalendarTaskCreateInput = {
  title: string;
  date: string;
  saved_notice_id: string | null;
  accessToken: string;
};

function validateCalendarTaskInput(input: unknown): CalendarTaskCreateInput {
  if (typeof input !== "object" || input === null) {
    throw new Error("할 일 정보를 확인해주세요.");
  }

  const value = input as Record<string, unknown>;
  if (
    typeof value["title"] !== "string" ||
    !value["title"].trim() ||
    typeof value["date"] !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value["date"]) ||
    !(value["saved_notice_id"] === null ||
      (typeof value["saved_notice_id"] === "string" && value["saved_notice_id"].trim())) ||
    typeof value["accessToken"] !== "string" ||
    !value["accessToken"].trim()
  ) {
    throw new Error("할 일 정보를 확인해주세요.");
  }

  return {
    title: value["title"].trim(),
    date: value["date"],
    saved_notice_id:
      typeof value["saved_notice_id"] === "string" ? value["saved_notice_id"].trim() : null,
    accessToken: value["accessToken"],
  };
}

export const createCalendarTask = createServerFn({ method: "POST" })
  .validator(validateCalendarTaskInput)
  .handler(async ({ data }) => {
    const webhookUrl = process.env["N8N_CALENDAR_TASK_WEBHOOK_URL"];
    if (!webhookUrl) {
      throw new Error("서버 웹훅 URL이 설정되지 않았습니다.");
    }

    // Prefer the known project variables and fall back only when they are not
    // present. An empty SUPABASE_* value must not hide a valid VITE_* value.
    const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
    const supabasePublishableKey =
      process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!supabaseUrl || !supabasePublishableKey) {
      throw new Error("서버 Supabase 환경변수가 설정되지 않았습니다.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabasePublishableKey, {
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(data.accessToken);
    if (userError || !userData.user) {
      throw new Error("로그인이 필요합니다.");
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userData.user.id,
        title: data.title,
        date: data.date,
        saved_notice_id: data.saved_notice_id,
      }),
    });

    if (!response.ok) {
      const responseText = (await response.text()).trim().replace(/\s+/g, " ");
      const detail = responseText ? ` ${responseText.slice(0, 240)}` : "";
      console.error("[calendar] calendar-task-create webhook failed", {
        status: response.status,
        body: responseText.slice(0, 500),
      });
      throw new Error(
        `할 일을 저장하지 못했어요. (웹훅 ${response.status})${detail}`,
      );
    }

    return { success: true };
  });
