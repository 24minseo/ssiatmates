import { Bell, ChevronDown, UserRound } from "lucide-react";

export function AppHeader() {
  return (
    <header className="flex h-16 items-center justify-end gap-5 px-10 text-[#84968E]">
      <button
        type="button"
        aria-label="알림"
        className="relative flex size-8 items-center justify-center rounded-lg hover:bg-item-hover"
      >
        <Bell aria-hidden className="size-5" strokeWidth={1.8} />
        <span className="absolute right-[6px] top-[5px] size-1.5 rounded-full bg-brand" />
      </button>
      <button
        type="button"
        className="flex h-8 items-center gap-1.5 rounded-lg px-1.5 text-sm font-medium text-ink-muted hover:bg-item-hover"
      >
        <UserRound
          aria-hidden
          className="size-5 text-[#84968E]"
          strokeWidth={1.8}
        />
        <span>아무개님</span>
        <ChevronDown aria-hidden className="size-4" strokeWidth={1.8} />
      </button>
    </header>
  );
}
