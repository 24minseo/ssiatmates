type NoticeLike = { notice_id?: string; id?: string; manual_notice_id?: string; source_kind?: string; is_saved?: boolean; heart_pending?: boolean };

type SavedApi = { setSaved: (itemOrId: NoticeLike | string, saved: boolean) => Promise<{ status?: string; is_saved: boolean; [key: string]: unknown }> };

export function createInstantNoticeHearts<T extends NoticeLike>({
  savedApi,
  getItems,
  setItems,
}: {
  savedApi: SavedApi;
  getItems: () => T[];
  setItems: (items: T[]) => void;
}) {
  let generation = 0;
  const overrides = new Map<string, boolean>();
  const pending = new Map<string, Promise<unknown>>();
  const key = (item: T | string) => {
    if (typeof item === "string") return item.startsWith("manual:") ? item : `matched:${item}`;
    if (item.manual_notice_id || item.source_kind === "manual") return `manual:${item.manual_notice_id ?? item.notice_id ?? item.id}`;
    return `matched:${item.notice_id ?? item.id}`;
  };
  const apply = (items: T[]) => items.map((item) => ({ ...item, ...(overrides.has(key(item)) ? { is_saved: overrides.get(key(item)) } : {}), heart_pending: pending.has(key(item)) }));
  const refresh = () => setItems(apply(getItems()));
  const toggle = (item: T) => {
    const id = key(item);
    if (pending.has(id)) return pending.get(id)!;
    const live = getItems().find((row) => key(row) === id) ?? item;
    const previous = overrides.has(id) ? overrides.get(id)! : live.is_saved === true;
    const next = !previous;
    const started = generation;
    const promise = Promise.resolve().then(async () => {
      try {
        const result = await savedApi.setSaved(item, next);
        if (started !== generation) return { status: "stale" };
        if (result?.status === "stale") { overrides.set(id, previous); return result; }
        if (result.is_saved !== next) throw new Error("하트 저장 결과를 확인하지 못했습니다.");
        return { ...result, status: "saved", is_saved: next };
      } catch (error) {
        if (started !== generation) return { status: "stale" };
        overrides.set(id, previous);
        return { status: "error", message: error instanceof Error ? error.message : "저장하지 못했습니다.", is_saved: previous };
      } finally {
        if (started === generation) { pending.delete(id); refresh(); }
      }
    });
    overrides.set(id, next);
    pending.set(id, promise);
    refresh();
    return promise;
  };
  return { toggle, apply, clear() { generation += 1; overrides.clear(); pending.clear(); } };
}
