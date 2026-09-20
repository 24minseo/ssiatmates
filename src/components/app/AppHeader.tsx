import { useMemo } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";

export function AppHeader() {
  const { user, profile, signOut } = useAuth();
  const displayName = useMemo(() => {
    const metadata = user?.user_metadata as Record<string, unknown> | undefined;
    const name =
      profile?.username ??
      (typeof metadata?.full_name === "string" ? metadata.full_name : null) ??
      (typeof metadata?.name === "string" ? metadata.name : null) ??
      user?.email?.split("@")[0] ??
      "사용자";
    return name.endsWith("님") ? name : `${name}님`;
  }, [profile?.username, user]);

  return (
    <header
      aria-label="앱 헤더"
      className="app-header-soft-edge absolute inset-x-0 top-0 z-20 flex h-[74px] min-w-0 w-full flex-none flex-row items-center justify-end self-stretch py-4 pl-8 pr-16"
      data-figma-node="903:284"
    >
      <div className="flex h-9 items-center gap-4">
        <button
          type="button"
          aria-label="알림"
          className="group relative flex size-9 shrink-0 items-center justify-center text-icon-muted transition-colors duration-150 ease-out hover:text-ink-muted focus-visible:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none"
        >
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-lg bg-item-hover opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none" />
          <svg aria-hidden="true" className="relative size-6" viewBox="0 0 24 24" fill="none">
            <path d="M6.66662 9.33335C6.66662 6.38782 9.05444 4 12 4C14.9455 4 17.3333 6.38782 17.3333 9.33335V10.7548C17.3333 12.0048 17.6802 13.2303 18.3353 14.2949L18.8228 15.0871C19.0299 15.4236 19.1335 15.5919 19.1712 15.7228C19.3255 16.2572 19.0139 16.8148 18.4779 16.9636C18.3466 17 18.1491 17 17.7539 17H6.24611C5.85093 17 5.65334 17 5.5221 16.9636C4.98611 16.8148 4.67454 16.2572 4.82874 15.7228C4.8665 15.5919 4.97006 15.4236 5.17716 15.0871L5.66463 14.2949C6.31976 13.2303 6.66662 12.0048 6.66662 10.7548V9.33335Z" fill="currentColor" stroke="currentColor" strokeWidth="2" />
            <circle cx="17.5" cy="6.5" r="4" fill="var(--brand)" stroke="var(--surface)" />
            <rect x="9" y="19" width="6" height="2" rx="1" fill="currentColor" />
          </svg>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="사용자 메뉴 열기"
              className="group relative -mr-1.5 flex h-9 w-auto min-w-[103px] shrink-0 items-center justify-center text-sm font-normal text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-lg bg-item-hover opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[state=open]:opacity-100 motion-reduce:transition-none" />
              <span className="relative flex h-9 items-center gap-[5px] px-px">
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
            <DropdownMenuItem className="cursor-default text-ink hover:bg-dropdown-hover data-[highlighted]:bg-dropdown-hover focus:bg-dropdown-hover focus:text-ink">
              계정 정보
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive hover:bg-destructive-surface data-[highlighted]:bg-destructive-surface focus:bg-destructive-surface focus:text-destructive"
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
