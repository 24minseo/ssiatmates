export type NotificationApiItem = {
  notification_id: string;
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
  const response = await fetch(`${NOTIFICATIONS_URL}?user_id=${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error("알림 목록을 불러오지 못했어요.");
  return (await response.json()) as NotificationsResponse;
}

export async function markNotificationsRead(userId: string): Promise<void> {
  const response = await fetch(MARK_READ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!response.ok) throw new Error("알림 읽음 처리를 완료하지 못했어요.");
}
