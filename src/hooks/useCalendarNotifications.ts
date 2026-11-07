import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getNotifications, markNotificationsRead } from "@/services/calendarNotificationsApi";

export function useCalendarNotifications() {
  const { user } = useAuth();
  const getFn = useServerFn(getNotifications), markFn = useServerFn(markNotificationsRead);
  const [notifications, setNotifications] = useState<unknown[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const owner = useRef(user?.id);
  const busy = useRef(false);
  owner.current = user?.id;
  const refresh = useCallback(async () => {
    if (!owner.current || busy.current) return;
    setLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session || session.user.id !== owner.current) return;
      const result = await getFn({ data: { accessToken: session.access_token } });
      setNotifications(result.notifications ?? []); setUnreadCount(result.unread_count ?? 0);
    } finally { setLoading(false); }
  }, [getFn]);
  const markRead = useCallback(async (notificationIds?: string[]) => {
    if (busy.current || !owner.current) return false;
    busy.current = true;
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session || session.user.id !== owner.current) return false;
      await markFn({ data: { accessToken: session.access_token, notificationIds: notificationIds ?? null } });
      await refresh(); return true;
    } finally { busy.current = false; }
  }, [markFn, refresh]);
  useEffect(() => { setNotifications([]); setUnreadCount(0); if (user?.id) void refresh(); }, [user?.id, refresh]);
  return { notifications, unreadCount, loading, refresh, markRead };
}
