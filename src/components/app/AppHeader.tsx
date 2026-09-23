import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CalendarClock, Sparkles, X } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getDisplayName, useAuth } from "@/hooks/useAuth";

export type NotificationType = "deadline" | "schedule" | "news";
export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timeLabel: string;
  read: boolean;
};

export const notificationExamples: AppNotification[] = [
  { id: "deadline-1", type: "deadline", title: "저장한 지원사업이 곧 마감돼요", description: "청년창업사관학교 · 3일 전", timeLabel: "3일 전", read: false },
  { id: "schedule-1", type: "schedule", title: "등록한 일정이 곧 시작돼요", description: "사업계획서 초안 작성 · 10분 전", timeLabel: "10분 전", read: true },
  { id: "news-1", type: "news", title: "새로운 맞춤 지원사업이 등록됐어요", description: "선호조건에 맞는 공고 2건 · 어제", timeLabel: "어제", read: true },
];

type AppHeaderProps = {
  /** Replace this with the notifications returned by Supabase/API when connected. */
  notifications?: AppNotification[];
};

export function AppHeader({ notifications = notificationExamples }: AppHeaderProps) {
  const { user, profile, signOut } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => new Set());
  const [notificationTab, setNotificationTab] = useState("전체");
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notificationsOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!notificationsRef.current?.contains(target) && !(target instanceof Element && target.closest("[data-notification-panel]"))) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [notificationsOpen]);
  const displayName = useMemo(() => getDisplayName(user, profile), [profile, user]);

  const visibleNotifications = useMemo(() => {
    const typeByTab: Record<string, NotificationType | undefined> = {
      마감: "deadline",
      일정: "schedule",
      "새 소식": "news",
    };
    const selectedType = typeByTab[notificationTab];
    return selectedType
      ? notifications.filter((notification) => notification.type === selectedType)
      : notifications;
  }, [notificationTab, notifications]);

  const groupedNotifications = useMemo(() => {
    const groups = new Map<string, AppNotification[]>();
    visibleNotifications.forEach((notification) => {
      const group = /방금|분 전|시간 전/.test(notification.timeLabel)
        ? "오늘"
        : notification.timeLabel === "어제"
          ? "어제"
          : "이전 알림";
      groups.set(group, [...(groups.get(group) ?? []), notification]);
    });
    return Array.from(groups, ([label, items]) => ({ label, items }));
  }, [visibleNotifications]);

  const isNotificationRead = (notification: AppNotification) => notification.read || readNotificationIds.has(notification.id);
  const unreadNotifications = notifications.filter((notification) => !isNotificationRead(notification));
  const unreadCountLabel = unreadNotifications.length > 99 ? "99+" : String(unreadNotifications.length);
  const markNotificationRead = (id: string) => setReadNotificationIds((current) => new Set(current).add(id));
  const markAllNotificationsRead = () => setReadNotificationIds((current) => new Set([...current, ...notifications.map((notification) => notification.id)]));

  return (
    <header
      aria-label="앱 헤더"
      className="app-header-soft-edge absolute inset-x-0 top-0 z-20 flex h-[74px] min-w-0 w-full flex-none flex-row items-center justify-end self-stretch py-4 pl-8 pr-16"
      data-figma-node="903:284"
    >
      <div className="flex h-9 items-center gap-1">
        <div ref={notificationsRef} className="relative">
          <button
            type="button"
            aria-label="알림"
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen((open) => !open)}
            className="group relative flex size-9 shrink-0 items-center justify-center text-icon-muted transition-colors duration-150 ease-out hover:text-ink-muted focus-visible:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none"
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-lg bg-item-hover opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 group-aria-expanded:opacity-100 motion-reduce:transition-none" />
            <svg aria-hidden="true" className="relative size-6" viewBox="0 0 24 24" fill="none">
            <path d="M6.66662 9.33335C6.66662 6.38782 9.05444 4 12 4C14.9455 4 17.3333 6.38782 17.3333 9.33335V10.7548C17.3333 12.0048 17.6802 13.2303 18.3353 14.2949L18.8228 15.0871C19.0299 15.4236 19.1335 15.5919 19.1712 15.7228C19.3255 16.2572 19.0139 16.8148 18.4779 16.9636C18.3466 17 18.1491 17 17.7539 17H6.24611C5.85093 17 5.65334 17 5.5221 16.9636C4.98611 16.8148 4.67454 16.2572 4.82874 15.7228C4.8665 15.5919 4.97006 15.4236 5.17716 15.0871L5.66463 14.2949C6.31976 13.2303 6.66662 12.0048 6.66662 10.7548V9.33335Z" fill="currentColor" stroke="currentColor" strokeWidth="2" />
            <circle cx="17.5" cy="6.5" r="4" fill="var(--brand)" stroke="var(--surface)" />
            <rect x="9" y="19" width="6" height="2" rx="1" fill="currentColor" />
            </svg>
          </button>
          {notificationsOpen ? createPortal(
            <>
              <div aria-hidden="true" className="fixed inset-0 z-[100] bg-black/10 backdrop-blur-[0.6px] animate-in fade-in duration-150" onClick={() => setNotificationsOpen(false)} />
              <aside data-notification-panel className="fixed bottom-4 right-4 top-4 z-[110] flex w-[400px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[16px] bg-surface shadow-dropdown animate-in slide-in-from-right duration-200 ease-out">
              <div className="flex items-center justify-between border-b border-border px-6 py-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-[20px] font-semibold text-ink">알림</h2>
                  {unreadNotifications.length > 0 ? (
                    <span
                      aria-label={`읽지 않은 알림 ${unreadNotifications.length}개`}
                      className="inline-flex h-6 min-w-6 items-center justify-center overflow-hidden rounded-[13px] bg-item-hover px-[7px] py-1 text-[14px] font-medium leading-none text-ink-muted"
                    >
                      {unreadCountLabel}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3"><button type="button" onClick={markAllNotificationsRead} disabled={!unreadNotifications.length} className="text-[13px] font-medium text-brand transition-opacity hover:underline disabled:pointer-events-none disabled:opacity-40">모두 읽음</button><button type="button" aria-label="알림 닫기" onClick={() => setNotificationsOpen(false)} className="flex size-9 items-center justify-center rounded-lg text-icon-muted opacity-100 transition-colors hover:bg-item-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-soft"><X className="size-6" /></button></div>
              </div>
              <div role="tablist" aria-label="알림 종류" className="flex border-b border-black/5 px-4">
                {[{ label: "전체" }, { label: "마감", type: "deadline" as NotificationType }, { label: "일정", type: "schedule" as NotificationType }, { label: "새 소식", type: "news" as NotificationType }].map((tab) => (
                  <button
                    key={tab.label}
                    type="button"
                    role="tab"
                    aria-selected={notificationTab === tab.label}
                    onClick={() => setNotificationTab(tab.label)}
                    className={`relative flex h-10 flex-1 items-center justify-center gap-1.5 px-1 text-[13px] font-medium transition-colors ${notificationTab === tab.label ? 'text-brand' : 'text-ink-muted hover:text-ink'} after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand after:transition-opacity ${notificationTab === tab.label ? 'after:opacity-100' : 'after:opacity-0'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-4">
                {groupedNotifications.length ? groupedNotifications.map((group) => (
                  <section key={group.label} aria-labelledby={`notification-group-${group.label}`}>
                    <h3 id={`notification-group-${group.label}`} className="px-3 pb-2 pt-4 text-[12px] font-semibold text-ink-muted">{group.label}</h3>
                    <div className="overflow-hidden rounded-[12px] border border-border/60 bg-surface">
                      {group.items.map((notification) => (
                        <button key={notification.id} type="button" onClick={() => markNotificationRead(notification.id)} className={`flex w-full gap-3 border-b border-border/60 px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-item-hover ${!isNotificationRead(notification) ? "bg-item-hover/40" : ""}`}>
                          <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${notification.type === "deadline" ? "bg-deadline-surface text-deadline" : notification.type === "schedule" ? "bg-item-hover text-brand" : "bg-pill text-brand"}`}>{notification.type === "deadline" ? <AlertTriangle className="size-4" /> : notification.type === "schedule" ? <CalendarClock className="size-4" /> : <Sparkles className="size-4" />}</span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold text-ink">{notification.title}</span><span className="mt-1 block truncate text-[13px] text-ink-muted">{notification.description}</span></span>
                          {!isNotificationRead(notification) ? <span className="mt-1 size-2 shrink-0 rounded-full bg-brand" /> : null}
                        </button>
                      ))}
                    </div>
                  </section>
                )) : <div className="flex min-h-[220px] items-center justify-center px-6 text-center text-[14px] text-ink-muted">이 유형의 알림이 없어요.</div>}
              </div>
              </aside>
            </>,
            document.body,
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="사용자 메뉴 열기"
              className="group relative -mr-1.5 flex h-9 w-max min-w-0 shrink-0 items-center justify-center text-sm font-normal text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-lg bg-item-hover opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[state=open]:opacity-100 motion-reduce:transition-none" />
              <span className="relative flex h-9 w-max shrink-0 items-center gap-[5px] px-4">
                <span className="flex shrink-0 items-center justify-center text-icon-muted transition-colors duration-150 ease-out group-hover:text-ink-muted group-focus-visible:text-ink-muted group-data-[state=open]:text-ink-muted motion-reduce:transition-none">
                  <span className="relative size-6 overflow-hidden">
                    <svg aria-hidden="true" className="absolute left-1/2 top-1/2 h-[27px] w-7 max-w-none -translate-x-1/2 -translate-y-1/2" viewBox="0 0 28 27" fill="none">
                      <path d="M6.40605 18.8184C7.19127 16.104 9.89941 14.625 12.7251 14.625H15.2749C18.1006 14.625 20.8087 16.104 21.594 18.8184C21.8369 19.6583 22.033 20.5704 22.1192 21.5013C22.1702 22.0513 21.719 22.5 21.1667 22.5H6.83333C6.28105 22.5 5.82985 22.0513 5.88077 21.5013C5.96697 20.5704 6.16307 19.6583 6.40605 18.8184Z" fill="currentColor" />
                      <path d="M10.3 8.94981C10.3001 6.90644 11.9568 5.24961 14.0002 5.24961L16.8322 5.24961C17.3114 5.24983 17.7002 5.63861 17.7004 6.11777V8.9498C17.7004 10.9932 16.0436 12.6499 14.0002 12.65C11.9567 12.65 10.3 10.9933 10.3 8.94981Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap">{displayName}</span>
                <img src="/assets/header/chevron-down.svg" alt="" className="h-[3.5px] w-[7px] shrink-0" />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="min-w-[128px] rounded-xl border-0 bg-surface p-1 shadow-none" style={{ boxShadow: "var(--shadow-dropdown)" }}>
            <DropdownMenuItem className="cursor-default px-[10px] text-ink hover:bg-dropdown-hover data-[highlighted]:bg-dropdown-hover focus:bg-dropdown-hover focus:text-ink">
              계정 정보
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer px-[10px] text-destructive hover:bg-destructive-surface data-[highlighted]:bg-destructive-surface focus:bg-destructive-surface focus:text-destructive"
              onSelect={() => void signOut()}
            >
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
