export function createManualNoticeViewApi(supabase: typeof import("@/integrations/supabase/client").supabase) {
  let generation = 0;
  async function list() {
    const started = generation;
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (sessionError || !userId) throw new Error("로그인 후 이용해주세요.");
    const { data, error } = await supabase.rpc("get_my_manual_notices_v1", { p_limit: 100, p_offset: 0 });
    if (started !== generation) return { status: "stale" as const };
    if (error) throw new Error(error.message || "수동공고를 불러오지 못했습니다.");
    if (!data || !Array.isArray(data.items)) throw new Error("수동공고 응답이 올바르지 않습니다.");
    return data;
  }
  return { list, clear() { generation++; } };
}
