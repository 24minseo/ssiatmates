import type { ReactNode } from "react";

import { AppHeader } from "./AppHeader";
import { AppSidebar, type AppNavigationKey } from "./AppSidebar";

type AppShellProps = {
  active: AppNavigationKey;
  children: ReactNode;
};

export function AppShell({ active, children }: AppShellProps) {
  return (
    <div className="h-screen min-h-0 overflow-hidden bg-item-hover text-ink">
      <div className="flex h-full min-w-0">
        <AppSidebar active={active} />
        <div className="relative z-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-l-[20px] bg-surface">
          <AppHeader />
          <main className="min-h-0 flex-1 overflow-auto overscroll-y-contain pt-[74px]">
            <div className="min-h-full min-w-[1264px]">
              <div className="mx-auto w-[1208px] pb-10 pt-[3px]">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
