import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarClock, LogOut, Sparkles } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getDisplayName, useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { deleteAccount } from "@/services/deleteAccountApi";
import { fetchNotifications, markNotificationsRead } from "@/services/notificationsApi";
import { toast } from "sonner";

export type NotificationType = "deadline" | "schedule" | "news";
export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timeLabel: string;
  read: boolean;
};

function mapNotification(item: {
  notification_id: string;
  message: string;
  notify_at?: string | null;
  sent_at?: string | null;
  read_at?: string | null;
  is_read?: boolean;
}): AppNotification {
  const date = item.notify_at ?? item.sent_at;
  const timeLabel = date ? new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(new Date(date)) : "";
  return {
    id: item.notification_id,
    type: "news",
    title: item.message,
    description: timeLabel,
    timeLabel,
    read: item.is_read === true || Boolean(item.read_at),
  };
}

type AppHeaderProps = {
  growthJournal?: boolean;
  growthJournalExpanded?: boolean;
};

export function AppHeader({
  growthJournal = false,
  growthJournalExpanded = false,
}: AppHeaderProps) {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const deleteAccountFn = useServerFn(deleteAccount);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [apiUnreadCount, setApiUnreadCount] = useState<number | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSaveError, setNameSaveError] = useState<string | null>(null);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => new Set());
  const [notificationTab, setNotificationTab] = useState("전체");
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notificationsOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !notificationsRef.current?.contains(target) &&
        !(target instanceof Element && target.closest("[data-notification-panel]"))
      ) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [notificationsOpen]);
  const displayName = useMemo(() => getDisplayName(user, profile), [profile, user]);
  const accountName = displayName.endsWith("님") ? displayName.slice(0, -1) : displayName;

  useEffect(() => {
    if (accountDialogOpen) {
      setNameInput(accountName);
      setNameSaveError(null);
    }
  }, [accountDialogOpen, accountName]);
  const isNotificationRead = (notification: AppNotification) =>
    notification.read || readNotificationIds.has(notification.id);

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
          : "";
      groups.set(group, [...(groups.get(group) ?? []), notification]);
    });
    const groupOrder = ["오늘", "어제", ""];
    return Array.from(groups, ([label, items]) => ({ label, items })).sort(
      (a, b) => groupOrder.indexOf(a.label) - groupOrder.indexOf(b.label),
    );
  }, [visibleNotifications]);

  const unreadNotifications = notifications.filter(
    (notification) => !isNotificationRead(notification),
  );
  const unreadCountLabel =
    unreadNotifications.length > 99 ? "99+" : String(unreadNotifications.length);
  const loginProvider = user?.app_metadata?.provider === "google" ? "Google" : "이메일";
  const markNotificationRead = (id: string) =>
    setReadNotificationIds((current) => new Set(current).add(id));
  const markAllNotificationsRead = () =>
    setReadNotificationIds(
      (current) => new Set([...current, ...notifications.map((notification) => notification.id)]),
    );

  const loadNotifications = useCallback(async (markRead = false) => {
    if (!user) {
      setNotifications([]);
      setApiUnreadCount(0);
      return;
    }

    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const result = await fetchNotifications(user.id);
      const next = (result.notifications ?? []).map(mapNotification);
      setNotifications(next);
      setApiUnreadCount(result.unread_count ?? next.filter((item) => !item.read).length);

      if (markRead) {
        await markNotificationsRead(user.id);
        setReadNotificationIds(new Set(next.map((item) => item.id)));
        setApiUnreadCount(0);
      }
    } catch (error) {
      console.error("[notifications] 알림 조회 실패", error);
      setNotificationsError("알림을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setNotificationsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const openNotifications = async () => {
    setProfileMenuOpen(false);
    setNotificationsOpen(true);
    await loadNotifications(true);
  };

  const handleAccountDeletion = async () => {
    if (isWithdrawing) return;
    setIsWithdrawing(true);
    setWithdrawalError(null);
    try {
      const { data, error } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (error || !accessToken) throw new Error("로그인이 필요합니다.");
      await deleteAccountFn({ data: { accessToken } });
      await signOut();
      setWithdrawalDialogOpen(false);
      setAccountDialogOpen(false);
    } catch (error) {
      console.error("[auth] 회원 탈퇴 실패", error);
      setWithdrawalError(error instanceof Error ? error.message : "회원 탈퇴를 완료하지 못했어요.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleNameSave = async () => {
    if (!user || isSavingName) return;
    const nextName = nameInput.trim();
    if (!nextName) {
      setNameSaveError("이름을 입력해주세요.");
      return;
    }

    setIsSavingName(true);
    setNameSaveError(null);
    const { error } = await supabase
      .from("profiles")
      .update({ username: nextName })
      .eq("id", user.id);

    if (error) {
      console.error("[profile] 이름 저장 실패", error);
      setNameSaveError("이름을 저장하지 못했어요.");
      setIsSavingName(false);
      return;
    }

    await refreshProfile();
    setNameInput(nextName);
    setIsSavingName(false);
    setAccountDialogOpen(false);
    toast.success("이름이 변경되었어요.");
  };
  const notificationTabs = [
    { label: "전체" },
    { label: "마감", type: "deadline" as NotificationType },
    { label: "일정", type: "schedule" as NotificationType },
  ] as const;
  const activeNotificationTabIndex = Math.max(
    notificationTabs.findIndex((tab) => tab.label === notificationTab),
    0,
  );

  return (
    <header
      aria-label="앱 헤더"
      className={`app-header-soft-edge ${growthJournal ? "growth-journal-header" : ""} ${growthJournalExpanded ? "growth-journal-header-expanded" : ""} absolute inset-x-0 top-0 z-20 flex h-[74px] min-w-0 w-full flex-none flex-row items-center justify-end self-stretch py-4 pl-8 pr-16`}
      data-figma-node="903:284"
    >
      <div ref={notificationsRef} className="relative flex h-9 items-center gap-1">
        <div className="relative">
          <button
            type="button"
            aria-label="알림"
            aria-expanded={notificationsOpen}
            data-state={notificationsOpen ? "open" : "closed"}
            onClick={() => (notificationsOpen ? setNotificationsOpen(false) : void openNotifications())}
            className={`group relative flex size-9 shrink-0 items-center justify-center text-icon-muted transition-colors duration-150 ease-out hover:text-ink-muted focus-visible:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none ${notificationsOpen ? "text-ink-muted" : ""}`}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-lg bg-item-hover opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[state=open]:opacity-100 motion-reduce:transition-none"
            />
            <svg aria-hidden="true" className="relative size-6" viewBox="0 0 24 24" fill="none">
              <path
                d="M6.66662 9.33335C6.66662 6.38782 9.05444 4 12 4C14.9455 4 17.3333 6.38782 17.3333 9.33335V10.7548C17.3333 12.0048 17.6802 13.2303 18.3353 14.2949L18.8228 15.0871C19.0299 15.4236 19.1335 15.5919 19.1712 15.7228C19.3255 16.2572 19.0139 16.8148 18.4779 16.9636C18.3466 17 18.1491 17 17.7539 17H6.24611C5.85093 17 5.65334 17 5.5221 16.9636C4.98611 16.8148 4.67454 16.2572 4.82874 15.7228C4.8665 15.5919 4.97006 15.4236 5.17716 15.0871L5.66463 14.2949C6.31976 13.2303 6.66662 12.0048 6.66662 10.7548V9.33335Z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="2"
              />
                {(apiUnreadCount ?? unreadNotifications.length) > 0 ? (
                <circle cx="17.5" cy="6.5" r="4" fill="var(--brand)" stroke="var(--surface)" />
              ) : null}
              <rect x="9" y="19" width="6" height="2" rx="1" fill="currentColor" />
            </svg>
          </button>
        </div>

        <DropdownMenu
          modal={false}
          open={profileMenuOpen}
          onOpenChange={(open) => {
            setProfileMenuOpen(open);
            if (open) setNotificationsOpen(false);
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="사용자 메뉴 열기"
              className="group relative -mr-1.5 flex h-9 w-max min-w-0 shrink-0 items-center justify-center text-sm font-normal text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-lg bg-item-hover opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[state=open]:opacity-100 motion-reduce:transition-none"
              />
              <span className="relative flex h-9 w-max shrink-0 items-center gap-[5px] pl-2 pr-2.5">
                <span className="flex shrink-0 items-center justify-center text-icon-muted transition-colors duration-150 ease-out group-hover:text-ink-muted group-focus-visible:text-ink-muted group-data-[state=open]:text-ink-muted motion-reduce:transition-none">
                  <span className="relative size-6 overflow-hidden">
                    <svg
                      aria-hidden="true"
                      className="absolute left-1/2 top-1/2 h-[27px] w-7 max-w-none -translate-x-1/2 -translate-y-1/2"
                      viewBox="0 0 28 27"
                      fill="none"
                    >
                      <path
                        d="M6.40605 18.8184C7.19127 16.104 9.89941 14.625 12.7251 14.625H15.2749C18.1006 14.625 20.8087 16.104 21.594 18.8184C21.8369 19.6583 22.033 20.5704 22.1192 21.5013C22.1702 22.0513 21.719 22.5 21.1667 22.5H6.83333C6.28105 22.5 5.82985 22.0513 5.88077 21.5013C5.96697 20.5704 6.16307 19.6583 6.40605 18.8184Z"
                        fill="currentColor"
                      />
                      <path
                        d="M10.3 8.94981C10.3001 6.90644 11.9568 5.24961 14.0002 5.24961L16.8322 5.24961C17.3114 5.24983 17.7002 5.63861 17.7004 6.11777V8.9498C17.7004 10.9932 16.0436 12.6499 14.0002 12.65C11.9567 12.65 10.3 10.9933 10.3 8.94981Z"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap">{displayName}</span>
                <img
                  src="/assets/header/chevron-down.svg"
                  alt=""
                  className="h-[3.5px] w-[7px] shrink-0"
                />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="min-w-[128px] rounded-xl border-0 bg-surface p-1 shadow-none"
            style={{ boxShadow: "var(--shadow-dropdown)" }}
          >
            <DropdownMenuItem
              className="cursor-pointer px-[10px] text-ink hover:bg-dropdown-hover data-[highlighted]:bg-dropdown-hover focus:bg-dropdown-hover focus:text-ink"
              onSelect={() => setAccountDialogOpen(true)}
            >
              계정 정보
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer px-[10px] text-ink hover:bg-dropdown-hover data-[highlighted]:bg-dropdown-hover focus:bg-dropdown-hover focus:text-ink"
              onSelect={() => void signOut()}
            >
              로그아웃
              <LogOut aria-hidden="true" className="ml-auto size-4 text-icon-muted" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
          <DialogContent
            closeClassName="right-5 top-7 flex size-9 items-center justify-center rounded-lg text-ink-muted opacity-100 transition-colors hover:bg-item-hover hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-soft [&_svg]:size-6"
            className="w-[520px] max-w-[calc(100vw-32px)] rounded-[20px] border-0 bg-surface p-8"
          >
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="pr-8 text-[20px] font-bold leading-7 text-ink">
                계정 정보
              </DialogTitle>
            </DialogHeader>
            <dl className="mt-6 grid gap-y-5">
              <div className="flex flex-col gap-2">
                <dt className="text-sm font-semibold text-submenu-text">이메일</dt>
                <dd aria-disabled="true" className="flex h-11 min-w-0 items-center truncate rounded-[12px] border border-field-border bg-field-border/25 px-3.5 text-[15px] text-[#A8B4B0]">{user?.email ?? "-"}</dd>
              </div>
              <div className="flex flex-col gap-2">
                <dt className="text-sm font-semibold text-submenu-text">로그인 방식</dt>
                <dd aria-disabled="true" className="flex h-11 items-center rounded-[12px] border border-field-border bg-field-border/25 px-3.5 text-[15px] text-[#A8B4B0]">{loginProvider}</dd>
              </div>
              <div className="flex flex-col gap-2">
                <dt className="text-sm font-semibold text-submenu-text">이름</dt>
                <dd className="flex min-w-0 items-center gap-3">
                  <input
                    type="text"
                    value={nameInput}
                    maxLength={50}
                    aria-label="이름"
                    onChange={(event) => {
                      setNameInput(event.target.value);
                      setNameSaveError(null);
                    }}
                    className="h-11 min-w-0 flex-1 rounded-[12px] border border-field-border bg-surface px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-guide-text focus:border-brand focus:ring-[3.2px] focus:ring-focus-soft"
                  />
                  <button
                    type="button"
                    disabled={isSavingName || !nameInput.trim() || nameInput.trim() === accountName}
                    onClick={() => void handleNameSave()}
                    className="h-11 shrink-0 rounded-[12px] border-0 bg-brand px-5 text-[15px] font-semibold text-brand-foreground shadow-none transition-colors hover:bg-brand/88 active:bg-brand-pressed disabled:cursor-not-allowed disabled:bg-brand-disabled disabled:text-brand-foreground disabled:opacity-100"
                  >
                    {isSavingName ? "저장 중..." : "변경 저장"}
                  </button>
                  {nameSaveError ? (
                    <p role="alert" className="mt-1 text-[13px] leading-5 text-destructive">
                      {nameSaveError}
                    </p>
                  ) : null}
                </dd>
              </div>
            </dl>
            <div className="-mx-8 mt-7 border-t border-field-border px-8 pt-5">
              <button
                type="button"
                onClick={() => {
                  setWithdrawalError(null);
                  setAccountDialogOpen(false);
                  setWithdrawalDialogOpen(true);
                }}
                className="text-[14px] font-medium text-ink-muted underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-soft"
              >
                회원 탈퇴
              </button>
              <p className="mt-3 text-[14px] leading-5 text-ink">
                탈퇴하면 SSIAT 계정과 저장한 지원사업, 캘린더 일정, 알림 등 서비스 정보가 삭제되며 복구할 수 없어요.
              </p>
            </div>
          </DialogContent>
        </Dialog>
        <AlertDialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
          <AlertDialogContent className="w-[520px] max-w-[calc(100vw-32px)] rounded-[20px] border-0 bg-surface p-8">
            <AlertDialogHeader className="space-y-2 text-left">
              <AlertDialogTitle className="pr-8 text-[20px] font-bold leading-7 text-ink">
                회원 탈퇴를 진행할까요?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[16px] leading-6 text-ink-muted">
                탈퇴 후에는 계정을 되돌릴 수 없어요. 저장한 지원사업과 일정도 더 이상 확인할 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {withdrawalError ? (
              <p role="alert" className="text-[13px] leading-5 text-destructive">
                {withdrawalError}
              </p>
            ) : null}
            <AlertDialogFooter className="mt-2 flex-row justify-end gap-2 sm:space-x-0">
              <AlertDialogCancel
                disabled={isWithdrawing}
                className="mt-0 h-11 rounded-[12px] border-0 bg-secondary-btn px-5 text-[15px] font-semibold text-secondary-btn-text shadow-none hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft"
              >
                취소
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isWithdrawing}
                onClick={(event) => {
                  event.preventDefault();
                  void handleAccountDeletion();
                }}
                className="h-11 rounded-[12px] border-0 bg-[#E95152] px-5 text-[15px] font-semibold text-white shadow-none hover:bg-[#E95152]/90 focus-visible:ring-1 focus-visible:ring-focus-soft"
              >
                {isWithdrawing ? "처리 중..." : "회원 탈퇴"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {notificationsOpen ? (
          <aside
            data-notification-panel
            className="absolute -right-1.5 top-[calc(100%+8px)] z-[110] flex max-h-[560px] w-[340px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[16px] bg-surface shadow-dropdown animate-in fade-in-0 zoom-in-95 duration-150 ease-out"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] font-semibold text-ink">알림</h2>
                <span
                  aria-label={`읽지 않은 알림 ${apiUnreadCount ?? unreadNotifications.length}개`}
                  className="inline-flex h-6 min-w-6 items-center justify-center overflow-hidden rounded-full bg-item-hover px-1.5 text-[14px] font-semibold leading-none text-ink-muted"
                >
                  {apiUnreadCount === null ? unreadCountLabel : apiUnreadCount > 99 ? "99+" : apiUnreadCount}
                </span>
              </div>
              <button
                type="button"
                onClick={markAllNotificationsRead}
                disabled={!unreadNotifications.length}
                className="text-[13px] font-medium text-brand transition-opacity hover:underline disabled:pointer-events-none disabled:opacity-40"
              >
                모두 읽음
              </button>
            </div>
            <div role="tablist" aria-label="알림 종류" className="px-4">
              <div className="relative flex border-b border-black/5">
                {notificationTabs.map((tab) => (
                  <button
                    key={tab.label}
                    type="button"
                    role="tab"
                    aria-selected={notificationTab === tab.label}
                    onClick={() => setNotificationTab(tab.label)}
                    className={`relative flex h-9 flex-1 items-center justify-center gap-1.5 px-0.5 text-[14px] transition-colors ${notificationTab === tab.label ? "font-semibold text-brand" : "font-medium text-ink-muted hover:text-ink"}`}
                  >
                    {tab.label}
                  </button>
                ))}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-px left-0 z-10 h-0.5 w-1/3 bg-brand transition-transform duration-200 ease-out motion-reduce:transition-none"
                  style={{ transform: `translateX(${activeNotificationTabIndex * 100}%)` }}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {notificationsLoading ? (
                <div className="flex min-h-[220px] items-center justify-center px-6 text-center text-[14px] text-ink-muted">
                  알림을 불러오는 중이에요.
                </div>
              ) : notificationsError ? (
                <div className="flex min-h-[220px] items-center justify-center px-6 text-center text-[14px] text-ink-muted">
                  {notificationsError}
                </div>
              ) : groupedNotifications.length ? (
                groupedNotifications.map((group) => (
                  <section
                    key={group.label || "older"}
                    aria-label={group.label || "알림 목록"}
                    className={group.label ? undefined : "mt-3 border-t border-border/60 pt-1"}
                  >
                    {group.label ? (
                      <h3 className="px-2 pb-1 pt-3 text-[11px] font-semibold text-ink-muted">
                        {group.label}
                      </h3>
                    ) : null}
                    <div className="overflow-hidden bg-surface">
                      {group.items.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => markNotificationRead(notification.id)}
                          className={`flex w-full gap-2.5 border-b border-border/60 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-item-hover ${!isNotificationRead(notification) ? "bg-item-hover/40" : ""}`}
                        >
                          <span
                            className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${notification.type === "deadline" ? "bg-deadline-surface text-deadline" : notification.type === "schedule" ? "bg-item-hover text-brand" : "bg-pill text-brand"}`}
                          >
                            {notification.type === "deadline" ? (
                              <AlertTriangle className="size-3.5" />
                            ) : notification.type === "schedule" ? (
                              <CalendarClock className="size-3.5" />
                            ) : (
                              <Sparkles className="size-3.5" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold text-ink">
                              {notification.title}
                            </span>
                            <span className="mt-0.5 block truncate text-[13px] text-ink-muted">
                              {notification.description}
                            </span>
                          </span>
                          {!isNotificationRead(notification) ? (
                            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="flex min-h-[220px] items-center justify-center px-6 text-center text-[14px] text-ink-muted">
                  {notificationTab === "전체"
                    ? "새 알림이 없어요."
                    : `${notificationTab} 알림이 없어요.`}
                </div>
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </header>
  );
}
