import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SavedNoticeState = {
  notice_id: string;
};

export type SavedNotice = {
  notice_id: string;
  source_kind?: "matched" | "manual";
  manual_notice_id?: string;
  title: string;
  organization: string;
  url: string | null;
  field: string | null;
  region: string | null;
  deadline: string | null;
  deadline_label: string | null;
  recruitment_status: string | null;
  status_label: string | null;
  days_until_deadline: number | null;
  is_closed: boolean;
  is_saved?: boolean;
  saved_notice_id?: string;
  saved_at?: string;
};

export type SavedNoticeListResponse = {
  items: SavedNotice[];
  total_count: number;
};

export type SavedNoticeMutationResponse = {
  notice_id: string;
  is_saved: boolean;
};

export type SavedNoticeProgressStatus = "not_started" | "preparing" | "submitted";

export type SavedNoticeProgress = {
  notice_id: string;
  status: SavedNoticeProgressStatus;
};

type SavedNoticesClient = Pick<SupabaseClient<Database>, "rpc">;

export function createSavedNoticesApi(
  client: SavedNoticesClient = supabase,
) {
  async function getSavedStates(): Promise<{ items: SavedNoticeState[] }> {
    const { data, error } = await client.rpc("get_my_saved_notice_ids_v1", {});
    if (error) throw error;
    const response = (data ?? {}) as { items?: SavedNoticeState[] };
    return { items: Array.isArray(response.items) ? response.items : [] };
  }

  async function setSaved(
    noticeId: string,
    isSaved: boolean,
  ): Promise<SavedNoticeMutationResponse> {
    if (!noticeId.trim()) throw new Error("공고 ID가 필요합니다.");
    if (typeof isSaved !== "boolean") {
      throw new Error("저장 여부는 true/false여야 합니다.");
    }

    const isManual = noticeId.startsWith("manual:");
    const id = isManual ? noticeId.slice("manual:".length) : noticeId;
    const { data, error } = await client.rpc(
      isManual ? "set_my_manual_notice_saved_v1" : "set_my_notice_saved_v1",
      isManual
        ? { p_manual_notice_id: id, p_saved: isSaved }
        : { p_notice_id: id, p_saved: isSaved },
    );
    if (error) throw error;
    if (!data) throw new Error("저장 상태 응답이 없습니다.");
    const response = data as SavedNoticeMutationResponse & { manual_notice_id?: string };
    return isManual
      ? { notice_id: noticeId, is_saved: response.is_saved }
      : response;
  }

  async function getMySupportNotices(): Promise<SavedNoticeListResponse> {
    const { data, error } = await client.rpc("get_my_support_notices_with_manual_v1", {});
    if (error) throw error;
    const response = (data ?? {}) as Partial<SavedNoticeListResponse>;
    return {
      items: Array.isArray(response.items) ? response.items : [],
      total_count: typeof response.total_count === "number" ? response.total_count : 0,
    };
  }

  async function getMyProgress(): Promise<{ items: SavedNoticeProgress[] }> {
    const { data, error } = await client.rpc("get_my_saved_notice_progress_v1", {});
    if (error) throw error;
    const response = (data ?? {}) as { items?: SavedNoticeProgress[] };
    return { items: Array.isArray(response.items) ? response.items : [] };
  }

  async function setProgress(
    noticeId: string,
    status: SavedNoticeProgressStatus,
  ): Promise<SavedNoticeProgress> {
    const { data, error } = await client.rpc("set_my_saved_notice_progress_v1", {
      p_notice_id: noticeId,
      p_status: status,
    });
    if (error) throw error;
    return data as SavedNoticeProgress;
  }

  return { getSavedStates, setSaved, getMySupportNotices, getMyProgress, setProgress };
}

export const savedNoticesApi = createSavedNoticesApi();

export function applySavedStates<T extends { notice_id: string }>(
  notices: T[],
  savedItems: SavedNoticeState[],
): Array<T & { is_saved: boolean }> {
  const savedIds = new Set(savedItems.map((item) => item.notice_id));
  return notices.map((item) => ({
    ...item,
    is_saved: savedIds.has(item.notice_id),
  }));
}
