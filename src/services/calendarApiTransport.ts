export type CalendarApiResult = {
  success: true;
  events?: unknown[];
  event?: unknown;
  status?: string;
  event_id?: string;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function requireToken(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("로그인이 필요합니다.");
  return value;
}
export function requireUuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("실제 저장된 일정 번호가 필요합니다.");
  }
  return value;
}

export async function callCalendarRpc(
  rpc: string,
  args: Record<string, unknown>,
  accessToken: string,
  webhookEnv?: string,
  webhookBody?: Record<string, unknown>,
): Promise<CalendarApiResult> {
  const project = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];
  const viaN8n = process.env["CALENDAR_API_TRANSPORT"] === "n8n";
  const webhook = webhookEnv ? process.env[webhookEnv] : undefined;
  if ((!viaN8n && (!project || !key)) || (viaN8n && !webhook)) {
    throw new Error("캘린더 서버 환경변수를 확인해주세요.");
  }
  const response = await fetch(viaN8n ? webhook! : `${project}/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(!viaN8n ? { apikey: key! } : {}),
    },
    body: JSON.stringify(viaN8n ? webhookBody ?? args : args),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(payload) || payload.success !== true) {
    if (response.status === 401) throw new Error("로그인이 필요합니다.");
    throw new Error(isRecord(payload) && typeof payload.message === "string"
      ? payload.message
      : `캘린더 요청에 실패했어요. (${response.status})`);
  }
  return payload as CalendarApiResult;
}
