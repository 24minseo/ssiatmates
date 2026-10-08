import { useEffect, useRef, useState, type ReactNode } from "react";

import { AppHeader } from "./AppHeader";
import { AppFooter } from "./AppFooter";
import { AppSidebar, type AppNavigationKey } from "./AppSidebar";

type AppShellProps = {
  active: AppNavigationKey;
  children: ReactNode;
};

export function AppShell({ active, children }: AppShellProps) {
  const mainRef = useRef<HTMLElement>(null);
  const [growthJournalExpanded, setGrowthJournalExpanded] = useState(false);
  const isGrowthJournal = active === "growth-journal";

  useEffect(() => {
    if (!isGrowthJournal) {
      setGrowthJournalExpanded(false);
      return;
    }

    const scrollContainer = mainRef.current;
    if (!scrollContainer) return;

    const updateStickyState = () => {
      const stickyTarget = Array.from(
        scrollContainer.querySelectorAll<HTMLElement>("[data-growth-journal-sticky]"),
      )
        .map((element) => ({ element, top: element.getBoundingClientRect().top }))
        .filter(({ top }) => top <= 74)
        .sort((left, right) => right.top - left.top)[0]?.element;

      setGrowthJournalExpanded(
        Boolean(stickyTarget && stickyTarget.getBoundingClientRect().top <= 74),
      );
    };

    updateStickyState();
    scrollContainer.addEventListener("scroll", updateStickyState, { passive: true });
    const observer = new MutationObserver(updateStickyState);
    observer.observe(scrollContainer, { childList: true, subtree: true });
    const frame = window.requestAnimationFrame(updateStickyState);

    return () => {
      scrollContainer.removeEventListener("scroll", updateStickyState);
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [isGrowthJournal]);

  return (
    <div className="h-dvh min-h-dvh min-h-0 overflow-hidden bg-item-hover text-ink">
      <div className="flex h-full min-w-0">
        <AppSidebar active={active} />
        <div className="relative z-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-l-[20px] bg-surface">
          <AppHeader
            growthJournal={isGrowthJournal}
            growthJournalExpanded={growthJournalExpanded}
          />
          <main
            ref={mainRef}
            className="min-h-0 flex-1 overflow-auto overscroll-y-contain pt-[74px]"
          >
            <div className="flex min-h-[calc(100dvh-74px)] min-w-[1264px] flex-col">
              <div className="mx-auto flex w-[1208px] flex-1 flex-col pt-[3px]">{children}</div>
              <AppFooter />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
