// Read-only completion checks. This never enqueues or starts a matching job.
type MatchingStatus = {
  user_id?: string; status?: string; profile_matches?: boolean; revision?: string | number | null;
};
type StatusClient = {
  rpc: (name: "get_my_profile_matching_status_v1") => PromiseLike<{
    data: unknown; error: unknown;
  }>;
};
export async function waitForCurrentProfileMatching(
  client: StatusClient,
  userId: string,
  options: { timeoutMs?: number; now?: () => number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<string> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const deadline = now() + (options.timeoutMs ?? 120_000);
  while (now() < deadline) {
    const { data, error } = await client.rpc("get_my_profile_matching_status_v1");
    if (error) throw error;
    const status = data as MatchingStatus | null;
    if (status?.user_id !== userId) throw new Error("매칭 상태의 사용자가 일치하지 않습니다.");
    if (status.status === "failed") throw new Error("프로필은 저장됐지만 매칭 작업이 실패했습니다.");
    if (status.status === "no_profile" || status.status === "not_requested") {
      throw new Error("저장된 프로필의 매칭 작업이 등록되지 않았습니다.");
    }
    if (status.status === "completed" && status.profile_matches === true && status.revision != null) {
      return String(status.revision);
    }
    await sleep(2_000);
  }
  throw new Error("프로필은 저장됐지만 매칭 완료 확인이 지연되고 있습니다. 잠시 후 다시 확인해주세요.");
}

