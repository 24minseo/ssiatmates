const ENDPOINT = "https://annie37.app.n8n.cloud/webhook/manual-program-update";

export function createManualNoticeUpdateApi(supabase: typeof import("@/integrations/supabase/client").supabase) {
  let generation = 0;
  const pending = new Map<string, Promise<unknown>>();

  async function update(manualNoticeId: string, changes: Record<string, string | null>) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(manualNoticeId)) {
      throw new Error("수정할 수동공고를 선택해주세요.");
    }
    const allowed = new Set(["title", "organization", "field", "region", "start_date", "deadline"]);
    const notice = Object.fromEntries(Object.entries(changes).filter(([key]) => allowed.has(key)).map(([key, value]) => [key, typeof value === "string" ? value.trim() || null : null]));
    if (!Object.keys(notice).length) throw new Error("수정할 항목이 없습니다.");
    if ("title" in notice && !notice.title) throw new Error("공고명을 입력해주세요.");
    const started = generation;
    const { data, error } = await supabase.auth.getSession();
    const session = data?.session;
    if (started !== generation) return { status: "stale" as const };
    if (error || !session?.access_token || !session.user?.id) throw new Error("로그인 후 다시 시도해주세요.");
    const key = JSON.stringify([session.user.id, manualNoticeId, notice]);
    if (pending.has(key)) return pending.get(key);
    const promise = fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ manual_notice_id: manualNoticeId, notice }) })
      .then(async (response) => { const result = await response.json().catch(() => null); if (!response.ok || result?.success !== true || result.status !== "updated") throw new Error(result?.message || "공고 수정에 실패했습니다."); return result; })
      .finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }
  return { update, clear() { generation++; pending.clear(); } };
}
