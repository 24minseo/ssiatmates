import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const COLORS = ["green", "red", "blue", "purple", "gray"] as const;
type ColorMap = Record<string, number>;
type Scope = {
  key: string;
  userId: string;
  active: boolean;
  ready: boolean;
  revision: number;
  desired: ColorMap;
  confirmed: ColorMap;
  pending: Set<string>;
};

export function useJournalStickerColors(
  userId: string | undefined,
  start: string | null,
  end: string | null,
) {
  const key = `${userId ?? ""}:${start ?? ""}:${end ?? ""}`;
  const scopeRef = useRef<Scope | null>(null);
  const [view, setView] = useState({ key: "", colors: {} as ColorMap, ready: false });

  useEffect(() => {
    if (!userId || !start || !end) {
      scopeRef.current = null;
      return;
    }
    const scope: Scope = {
      key,
      userId,
      active: true,
      ready: false,
      revision: 0,
      desired: {},
      confirmed: {},
      pending: new Set(),
    };
    scopeRef.current = scope;
    let loading = false;
    const load = async () => {
      if (document.hidden || loading || scope.pending.size > 0) return;
      loading = true;
      const revision = scope.revision;
      try {
        // Preserve browser-only selections once, without overwriting server colors.
        const storageKey = `ssiat:journal-sticker-colors:${userId}`;
        let local: unknown;
        try {
          local = JSON.parse(localStorage.getItem(storageKey) ?? "null");
        } catch {
          local = null;
        }
        if (local && typeof local === "object" && !Array.isArray(local)) {
          const rows = Object.entries(local).flatMap(([date, value]) =>
            /^\d{4}-\d{2}-\d{2}$/.test(date) &&
            typeof value === "number" &&
            Number.isInteger(value) &&
            value >= 0 &&
            value < COLORS.length
              ? [{ user_id: userId, diary_date: date, color: COLORS[value]! }]
              : [],
          );
          if (rows.length) {
            const { error } = await supabase
              .from("journal_sticker_colors")
              .upsert(rows, { onConflict: "user_id,diary_date", ignoreDuplicates: true });
            if (error) throw error;
          }
          try {
            localStorage.removeItem(storageKey);
          } catch {
            /* Storage may be blocked. */
          }
        }
        if (!scope.active) return;
        const { data, error } = await supabase
          .from("journal_sticker_colors")
          .select("diary_date,color")
          .eq("user_id", userId)
          .gte("diary_date", start)
          .lte("diary_date", end);
        if (error) throw error;
        if (!scope.active || revision !== scope.revision) return;
        const colors: ColorMap = {};
        for (const row of data ?? []) {
          const index = COLORS.findIndex((color) => color === row.color);
          if (index >= 0) colors[row.diary_date] = index;
        }
        scope.confirmed = { ...colors };
        scope.desired = colors;
        scope.ready = true;
        setView({ key, colors: { ...colors }, ready: true });
      } catch {
        if (scope.active)
          toast.error("스티커 색상을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      } finally {
        loading = false;
      }
    };
    const refresh = () => {
      void load();
    };
    void load();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      scope.active = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [key, userId, start, end]);

  const cycleColor = (date: string) => {
    const scope = scopeRef.current;
    if (!scope || !scope.active || !scope.ready || scope.key !== key) return;
    scope.revision += 1;
    scope.desired[date] = ((scope.desired[date] ?? 0) + 1) % COLORS.length;
    setView({ key, colors: { ...scope.desired }, ready: true });
    if (scope.pending.has(date)) return;
    scope.pending.add(date);
    const save = async () => {
      try {
        // Serialize each date's writes so rapid clicks cannot save out of order.
        while ((scope.desired[date] ?? 0) !== (scope.confirmed[date] ?? 0)) {
          const target = scope.desired[date]!;
          const { error } = await supabase
            .from("journal_sticker_colors")
            .upsert(
              { user_id: scope.userId, diary_date: date, color: COLORS[target]! },
              { onConflict: "user_id,diary_date" },
            )
            .select("color")
            .single();
          if (error) throw error;
          scope.confirmed[date] = target;
        }
      } catch {
        scope.desired[date] = scope.confirmed[date] ?? 0;
        if (scope.active) {
          setView({ key, colors: { ...scope.desired }, ready: true });
          toast.error("스티커 색상을 저장하지 못해 이전 색으로 되돌렸어요.");
        }
      } finally {
        scope.pending.delete(date);
      }
    };
    void save();
  };

  return {
    colors: view.key === key ? view.colors : {},
    ready: view.key === key && view.ready,
    cycleColor,
  };
}
