import { supabase } from "@/integrations/supabase/client";

type CalendarResponse = {
  connected?: boolean;
  isConnected?: boolean;
  authorizationUrl?: string;
  authorization_url?: string;
  authUrl?: string;
  success?: boolean;
  error?: string;
  message?: string;
  code?: string;
  inserted?: number;
  updated?: number;
  removed?: number;
  skipped_exported?: number;
  synced_at?: string;
};

export class GoogleCalendarError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "GoogleCalendarError";
  }
}

async function invokeCalendar(functionName: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  let session = data.session;
  if (!session) throw new Error("로그인이 필요합니다. 다시 로그인해주세요.");
  if (!session.access_token || (session.expires_at ?? 0) * 1000 <= Date.now() + 30_000) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error) throw refreshed.error;
    session = refreshed.data.session;
  }
  if (!session?.access_token) throw new Error("로그인이 필요합니다. 다시 로그인해주세요.");

  const result = await supabase.functions.invoke<CalendarResponse>(functionName, {
    body,
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  if (result.error) {
    const response = (result.error as { context?: Response }).context;
    let detail: CalendarResponse | null = null;
    if (response && typeof response.clone === "function") {
      detail = await response.clone().json().catch(() => null);
    }
    throw new GoogleCalendarError(
      detail?.error ?? detail?.message ?? "구글 캘린더 요청에 실패했습니다. 잠시 후 다시 시도해주세요.",
      detail?.code,
    );
  }
  if (!result.data) throw new GoogleCalendarError("구글 캘린더 응답을 받지 못했습니다.");
  if (result.data.error || result.data.success === false) {
    throw new GoogleCalendarError(result.data.error ?? result.data.message ?? "구글 캘린더 요청에 실패했습니다.", result.data.code);
  }
  return result.data;
}

export async function getGoogleCalendarStatus() {
  const data = await invokeCalendar("google-calendar", { action: "status" });
  return data.connected === true || data.isConnected === true;
}

// Also use this to request additional consent without disconnecting first.
export async function connectGoogleCalendar() {
  const data = await invokeCalendar("google-calendar", { action: "connect" });
  const url = data.authorizationUrl ?? data.authorization_url ?? data.authUrl;
  if (!url) throw new Error("Google 로그인 주소를 받지 못했습니다.");
  return url;
}

export async function disconnectGoogleCalendar() {
  await invokeCalendar("google-calendar", { action: "disconnect" });
}

// Dates are YYYY-MM-DD; rangeEnd is exclusive. Maximum range: 93 days.
export async function importGoogleCalendarEvents(rangeStart: string, rangeEnd: string) {
  const data = await invokeCalendar("google-calendar-import", {
    range_start: rangeStart,
    range_end: rangeEnd,
  });
  if (data.success !== true) throw new Error("일정 가져오기 완료 여부를 확인하지 못했습니다.");
  return data;
}

