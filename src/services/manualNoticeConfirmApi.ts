import type { SupabaseClient } from "@supabase/supabase-js";

const ENDPOINT = "https://annie37.app.n8n.cloud/webhook/manual-program-favorite";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ManualNoticeConfirmResult = {
  status: "confirmed";
  success: true;
  manual_notice_id: string;
  notice: Record<string, unknown>;
  report: unknown;
};
type Outcome = ManualNoticeConfirmResult | { status: "stale" };

export function createManualNoticeConfirmApi(supabase: SupabaseClient) {
  const pending = new Map<string, Promise<Outcome>>();
  let generation = 0;

  async function confirm(manualNoticeId: string): Promise<Outcome> {
    if (!UUID_RE.test(manualNoticeId)) throw new Error("먼저 공고 분석을 완료해주세요.");
    const started = generation;
    const { data, error } = await supabase.auth.getSession();
    const session = data.session;
    if (started !== generation) return { status: "stale" };
    if (error || !session?.access_token || !session.user.id) throw new Error("로그인 후 다시 시도해주세요.");
    const key = JSON.stringify([session.user.id, manualNoticeId]);
    const existing = pending.get(key);
    if (existing) return existing;
    const promise = Promise.resolve().then(async () => {
      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ manual_notice_id: manualNoticeId }),
        });
        const result = await response.json().catch(() => null) as Partial<ManualNoticeConfirmResult> & { message?: unknown } | null;
        const current = await supabase.auth.getSession();
        if (started !== generation || current.error || current.data.session?.user.id !== session.user.id) return { status: "stale" };
        if (!response.ok || result?.success !== true || result.status !== "confirmed" || result.manual_notice_id !== manualNoticeId || !result.notice || !result.report) {
          throw new Error(typeof result?.message === "string" ? result.message : "저장 확정 결과를 확인하지 못했습니다.");
        }
        return result as ManualNoticeConfirmResult;
      } finally {
        if (pending.get(key) === promise) pending.delete(key);
      }
    });
    pending.set(key, promise);
    return promise;
  }
  return { confirm, clear: () => { generation += 1; pending.clear(); } };
}
