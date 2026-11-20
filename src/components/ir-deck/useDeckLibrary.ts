import { useEffect, useRef, useState } from "react";
import { listLibrary, type LibraryItem } from "./library";
import { libraryRpc } from "./library-client";

export function useDeckLibrary(owner: string | undefined, enabled: boolean) {
  const [state, setState] = useState<{
    owner?: string;
    items: LibraryItem[];
    ready: boolean;
    error: string;
  }>({ items: [], ready: false, error: "" });
  const [epoch, setEpoch] = useState(0);
  const version = useRef(0);
  useEffect(() => {
    if (!owner || !enabled) return;
    let stopped = false,
      running = false;
    const run = async () => {
      if (running) return;
      running = true;
      const request = ++version.current;
      try {
        const items = await listLibrary(libraryRpc, owner);
        if (!stopped && version.current === request)
          setState({ owner, items, ready: true, error: "" });
      } catch (error) {
        if (!stopped && version.current === request)
          setState((current) => ({
            owner,
            items: current.owner === owner ? current.items : [],
            ready: current.owner === owner && current.ready,
            error: error instanceof Error ? error.message : "덱 목록을 불러오지 못했습니다.",
          }));
      } finally {
        running = false;
      }
    };
    void run();
    window.addEventListener("focus", run);
    return () => {
      stopped = true;
      window.removeEventListener("focus", run);
    };
  }, [owner, enabled, epoch]);
  const refresh = () => {
    version.current++;
    setEpoch((n) => n + 1);
  };
  return {
    items: state.owner === owner ? state.items : [],
    ready: !!owner && state.owner === owner && state.ready,
    error: state.owner === owner ? state.error : "",
    refresh,
    remove: (deck: string) => {
      version.current++;
      setState((s) => ({ ...s, items: s.items.filter((i) => i.deck_id !== deck) }));
      refresh();
    },
    rename: (deck: string, title: string) => {
      version.current++;
      setState((s) => ({
        ...s,
        items: s.items.map((i) =>
          i.deck_id === deck ? { ...i, title, updated_at: new Date().toISOString() } : i,
        ),
      }));
      refresh();
    },
  };
}
