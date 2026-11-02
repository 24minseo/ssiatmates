const ENDPOINT = "https://annie37.app.n8n.cloud/webhook/manual-program-delete";

export function createManualNoticeDeleteApi(supabase: typeof import("@/integrations/supabase/client").supabase) {
  let generation = 0;
  const pending = new Map<string, Promise<unknown>>();

  async function remove(manualNoticeId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(manualNoticeId)) {
      throw new Error("삭제할 수동공고를 선택해주세요.");
    }
    const started = generation;
    const { data, error } = await supabase.auth.getSession();
    const session = data?.session;
    if (started !== generation) return { status: "stale" as const };
    if (error || !session?.access_token || !session.user?.id) throw new Error("로그인 후 다시 시도해주세요.");
    const key = JSON.stringify([session.user.id, manualNoticeId]);
    if (pending.has(key)) return pending.get(key);
    const promise = fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ manual_notice_id: manualNoticeId }) })
      .then(async (response) => { const result = await response.json().catch(() => null); if (!response.ok || result?.success !== true || result.status !== "deleted" || result.manual_notice_id !== manualNoticeId || typeof result.deleted !== "boolean") throw new Error(result?.message || "공고 삭제에 실패했습니다."); return result; })
      .finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }
  return { remove, clear() { generation++; pending.clear(); } };
}
