import type { SupabaseClient } from "@supabase/supabase-js";
import { notifySavedNoticesChanged } from "./savedNoticeEvents";

const ENDPOINT = "https://annie37.app.n8n.cloud/webhook/manual-program-favorite";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ManualNoticeConfirmResult = {
  status: "confirmed";
  success: true;
  manual_notice_id: string;
  is_saved: true;
  saved_notice_id: string;
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
    if (started !== generation) return { status: "stale" as const };
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
        if (started !== generation || current.error || current.data.session?.user.id !== session.user.id) return { status: "stale" as const };
        if (!response.ok || result?.success !== true || result.status !== "confirmed" || result.manual_notice_id !== manualNoticeId || !result.notice || !result.report) {
          throw new Error(typeof result?.message === "string" ? result.message : "저장 확정 결과를 확인하지 못했습니다.");
        }
        // Confirming an analysis and saving a favorite are separate operations.
        // A successful add must complete both. Never do this during list reloads:
        // an explicit unsave must remain unsaved.
        const { data: saved, error: saveError } = await supabase.rpc(
          "set_my_manual_notice_saved_v1",
          { p_manual_notice_id: manualNoticeId, p_saved: true },
        );
        const afterSave = await supabase.auth.getSession();
        if (started !== generation || afterSave.error ||
            afterSave.data.session?.user.id !== session.user.id) return { status: "stale" as const };
        if (saveError || saved?.success !== true || saved.is_saved !== true ||
            saved.manual_notice_id !== manualNoticeId ||
            typeof saved.saved_notice_id !== "string" || !UUID_RE.test(saved.saved_notice_id)) {
          throw new Error("공고는 추가됐지만 내 지원사업 저장을 확인하지 못했습니다. 저장하기를 다시 눌러주세요.");
        }
        notifySavedNoticesChanged();
        return { ...result, is_saved: true, saved_notice_id: saved.saved_notice_id } as ManualNoticeConfirmResult;
      } finally {
        if (pending.get(key) === promise) pending.delete(key);
      }
    });
    pending.set(key, promise);
    return promise;
  }
  return { confirm, clear: () => { generation += 1; pending.clear(); } };
}
