import { createServerFn } from "@tanstack/react-start";
import { callCalendarRpc, isRecord, requireToken } from "./calendarApiTransport";
export const getNotifications = createServerFn({ method: "POST" }).validator((input: unknown) => {
  if (!isRecord(input)) throw new Error("로그인이 필요합니다.");
  return { accessToken: requireToken(input.accessToken) } as any;
}).handler(({ data }) => callCalendarRpc("get_my_notifications_v3", {}, data.accessToken, "N8N_NOTIFICATIONS_WEBHOOK_URL", {}));
export const markNotificationsRead = createServerFn({ method: "POST" }).validator((input: unknown) => {
  if (!isRecord(input)) throw new Error("로그인이 필요합니다.");
  return { accessToken: requireToken(input.accessToken), notificationIds: Array.isArray(input.notificationIds) ? input.notificationIds : null } as any;
}).handler(({ data }) => callCalendarRpc("mark_my_notifications_read_v3", { p_notification_ids: data.notificationIds }, data.accessToken, "N8N_NOTIFICATIONS_MARK_READ_WEBHOOK_URL", { notification_ids: data.notificationIds }));
