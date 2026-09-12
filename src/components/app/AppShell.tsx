import type { ReactNode } from "react";

import { AppHeader } from "./AppHeader";
import { AppSidebar, type AppNavigationKey } from "./AppSidebar";

type AppShellProps = {
  active: AppNavigationKey;
  children: ReactNode;
};

export function AppShell({ active, children }: AppShellProps) {
  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-[#F6F8F7] text-ink">
      <AppSidebar active={active} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-l-[20px] bg-surface">
        <AppHeader />
        <main className="min-h-0 flex-1 overflow-x-auto overflow-y-auto px-8 py-10 md:px-12 xl:px-[104px]">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
