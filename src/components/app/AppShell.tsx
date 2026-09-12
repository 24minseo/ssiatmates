import type { ReactNode } from "react";

import { AppHeader } from "./AppHeader";
import { AppSidebar, type AppNavigationKey } from "./AppSidebar";

type AppShellProps = {
  active: AppNavigationKey;
  children: ReactNode;
};

export function AppShell({ active, children }: AppShellProps) {
  return (
    <div className="h-screen min-h-0 overflow-x-auto overflow-y-hidden bg-item-hover text-ink">
      <div className="flex h-full min-w-max">
        <AppSidebar active={active} />
        <div className="flex w-[1432px] shrink-0 flex-col overflow-hidden rounded-l-[20px] bg-surface">
          <AppHeader />
          <main className="min-h-0 flex-1 overflow-y-auto px-[104px] py-10">
            <div className="mx-auto w-full min-w-[1208px] max-w-[1208px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
