export type NotificationApiItem = {
  notification_id: string;
  program_id?: string | null;
  calendar_event_id?: string | null;
  message: string;
  notify_at?: string | null;
  sent_at?: string | null;
  status?: string | null;
  read_at?: string | null;
  is_read?: boolean;
};

export type NotificationsResponse = {
  success?: boolean;
  unread_count?: number;
  count?: number;
  notifications?: NotificationApiItem[];
};

const NOTIFICATIONS_URL = "https://annie37.app.n8n.cloud/webhook/notifications";
const MARK_READ_URL = "https://annie37.app.n8n.cloud/webhook/notifications-mark-read";

export async function fetchNotifications(userId: string): Promise<NotificationsResponse> {
  if (!userId.trim()) throw new Error("로그인이 필요합니다.");
  const response = await fetch(`${NOTIFICATIONS_URL}?user_id=${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error("알림 목록을 불러오지 못했어요.");
  const result = (await response.json()) as NotificationsResponse;
  if (result.success === false) throw new Error("알림 목록을 불러오지 못했어요.");
  if (!Array.isArray(result.notifications)) {
    throw new Error("알림 목록 응답을 확인해주세요.");
  }
  if (
    result.unread_count !== undefined &&
    (!Number.isSafeInteger(result.unread_count) || result.unread_count < 0)
  ) {
    throw new Error("알림 개수 응답을 확인해주세요.");
  }
  return result;
}

export async function markNotificationsRead(userId: string): Promise<void> {
  const response = await fetch(MARK_READ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!response.ok) throw new Error("알림 읽음 처리를 완료하지 못했어요.");
}
