import { supabase } from "@/integrations/supabase/client";

type GoogleCalendarResponse = {
  connected?: boolean;
  isConnected?: boolean;
  authorizationUrl?: string;
  message?: string;
};

async function invokeGoogleCalendar(action: "connect" | "status" | "disconnect", sessionAccessToken?: string) {
  // Always re-read the client session immediately before invoking the function.
  // The token captured by React can be stale while Supabase is rotating it.
  const { data: sessionData } = await supabase.auth.getSession();
  let accessToken = sessionData.session?.access_token ?? sessionAccessToken;
  if (!accessToken || sessionData.session?.expires_at && sessionData.session.expires_at * 1000 <= Date.now() + 30_000) {
    const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw refreshError;
    accessToken = refreshedSession.session?.access_token ?? accessToken;
  }
  if (!accessToken) throw new Error("로그인이 필요합니다.");

  const { data, error } = await supabase.functions.invoke<GoogleCalendarResponse>("google-calendar", {
    body: { action },
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (error) {
    const response = (error as { context?: Response }).context;
    if (response) {
      const detail = await response.clone().text().catch(() => "");
      if (detail) {
        try {
          const parsed = JSON.parse(detail) as { error?: string; message?: string };
          throw new Error(parsed.error ?? parsed.message ?? detail);
        } catch (parseError) {
          if (parseError instanceof SyntaxError) throw new Error(detail);
          throw parseError;
        }
      }
    }
    throw error;
  }
  return data ?? {};
}

export async function getGoogleCalendarStatus(sessionAccessToken?: string) {
  const data = await invokeGoogleCalendar("status", sessionAccessToken);
  return data.connected === true || data.isConnected === true;
}

export async function connectGoogleCalendar(sessionAccessToken?: string) {
  const data = await invokeGoogleCalendar("connect", sessionAccessToken);
  if (!data.authorizationUrl) throw new Error("Google Calendar 연결 주소를 받지 못했어요.");
  return data.authorizationUrl;
}

export async function disconnectGoogleCalendar(sessionAccessToken?: string) {
  await invokeGoogleCalendar("disconnect", sessionAccessToken);
}
