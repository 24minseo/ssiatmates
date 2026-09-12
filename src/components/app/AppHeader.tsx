export function AppHeader() {
  return (
    <header
      aria-label="앱 헤더"
      className="flex h-[74px] w-full shrink-0 items-center justify-end bg-surface py-4 pl-8 pr-16"
      data-figma-node="903:284"
    >
      <div className="flex h-9 items-center gap-5">
        <button
          type="button"
          aria-label="알림"
          className="size-6 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <img
            src="/assets/header/notification.svg"
            alt=""
            className="block size-full"
          />
        </button>

        <button
          type="button"
          aria-label="사용자 메뉴 열기"
          className="flex h-9 w-[91px] shrink-0 items-center gap-[5px] overflow-hidden px-px text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span className="flex shrink-0 items-center justify-center">
            <span className="relative size-6 overflow-hidden">
              <img
                src="/assets/header/user.svg"
                alt=""
                className="absolute left-1/2 top-1/2 h-[27px] w-7 max-w-none -translate-x-1/2 -translate-y-1/2"
              />
            </span>
          </span>
          <span className="shrink-0 whitespace-nowrap">아무개님</span>
          <img
            src="/assets/header/chevron-down.svg"
            alt=""
            className="h-[3.5px] w-[7px] shrink-0"
          />
        </button>
      </div>
    </header>
  );
}
