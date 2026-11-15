import { supabase } from "@/integrations/supabase/client";

type GoogleCalendarResponse = {
  connected?: boolean;
  isConnected?: boolean;
  authorizationUrl?: string;
  authorization_url?: string;
  authUrl?: string;
  message?: string;
};

async function invokeGoogleCalendar(action: "connect" | "status" | "disconnect") {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const session = sessionData.session;
  let accessToken = session?.access_token;
  if (session && (!accessToken || (session.expires_at ?? 0) * 1000 <= Date.now() + 30_000)) {
    const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw refreshError;
    accessToken = refreshedSession.session?.access_token;
  }
  console.log("[Google Calendar] session exists:", Boolean(accessToken));
  if (!session || !accessToken) throw new Error("로그인 세션이 없습니다. 다시 로그인해 주세요.");

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

export async function getGoogleCalendarStatus() {
  const data = await invokeGoogleCalendar("status");
  return data.connected === true || data.isConnected === true;
}

export async function connectGoogleCalendar() {
  const data = await invokeGoogleCalendar("connect");
  const authorizationUrl = data.authorizationUrl ?? data.authorization_url ?? data.authUrl;
  if (!authorizationUrl) throw new Error("Google 로그인 주소를 받지 못했습니다.");
  return authorizationUrl;
}

export async function disconnectGoogleCalendar() {
  await invokeGoogleCalendar("disconnect");
}
