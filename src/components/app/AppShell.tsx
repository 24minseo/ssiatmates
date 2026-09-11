import type { ReactNode } from "react";

import { AppHeader } from "./AppHeader";
import { AppSidebar, type AppNavigationKey } from "./AppSidebar";

type AppShellProps = {
  active: AppNavigationKey;
  children: ReactNode;
};

export function AppShell({ active, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-[#F6F8F7] text-ink">
      <AppSidebar active={active} />
      <div className="min-w-0 flex-1">
        <AppHeader />
        <main className="min-h-[calc(100vh-64px)] rounded-tl-[24px] bg-surface px-8 py-10 md:px-12 xl:px-[104px]">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
