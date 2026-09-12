import { Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { useState, type CSSProperties } from "react";

export type AppNavigationKey =
  | "home"
  | "programs"
  | "my-programs"
  | "calendar"
  | "growth-journal";

type AppSidebarProps = {
  active: AppNavigationKey;
};

const navigation = [
  {
    key: "home",
    label: "MY홈",
    to: "/myhome",
    icon: "/assets/sidebar/home.svg",
  },
  {
    key: "programs",
    label: "지원사업 탐색",
    to: "/programs",
    icon: "/assets/sidebar/program-search.svg",
  },
  {
    key: "my-programs",
    label: "내 지원사업",
    to: "/my-programs",
    icon: "/assets/sidebar/my-programs.svg",
  },
  {
    key: "calendar",
    label: "전체 캘린더",
    to: "/calendar",
    icon: "/assets/sidebar/calendar.svg",
  },
] as const;

function NavigationIcon({ src }: { src: string }) {
  const maskStyle = {
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  } satisfies CSSProperties;

  return (
    <span
      aria-hidden
      className="size-6 shrink-0 bg-current"
      style={maskStyle}
    />
  );
}

export function AppSidebar({ active }: AppSidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const calendarActive = active === "calendar" || active === "growth-journal";

  return (
    <aside
      className={`sticky top-0 z-30 h-screen shrink-0 bg-[#F6F8F7] transition-[width] duration-200 ease-out ${
        expanded ? "w-[240px]" : "w-20"
      }`}
    >
      <div className="relative flex h-full flex-col px-4 pt-5">
        <div
          className={`flex h-8 items-center ${expanded ? "px-[15px]" : "justify-center"}`}
        >
          {expanded ? (
            <img
              src="/assets/sidebar/ssiat-logo.svg"
              alt="SSIAT"
              className="h-5 w-[104px]"
            />
          ) : (
            <img
              src="/assets/sidebar/ssiat-symbol.svg"
              alt="SSIAT"
              className="h-[28px] w-[37px] -translate-x-[2px] object-contain"
            />
          )}
        </div>

        <button
          type="button"
          aria-label={expanded ? "사이드바 접기" : "사이드바 펼치기"}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className={`absolute top-5 flex size-8 items-center justify-center rounded-lg bg-[#F6F8F7] text-[#BDBDBD] transition-colors hover:bg-[#EEF2F0] ${
            expanded ? "right-[14px]" : "-right-[15px] border-2 border-white"
          }`}
        >
          <img
            src="/assets/sidebar/sidebar-toggle.svg"
            alt=""
            className={`h-4 w-5 transition-transform duration-200 ${expanded ? "" : "rotate-180"}`}
          />
        </button>

        <button
          type="button"
          aria-label="현재 프로젝트 정보 수정"
          className={`mt-[27px] bg-[#FEFEFE] shadow-[1px_1px_0_1px_rgba(185,201,194,0.25)] ${
            expanded
              ? "flex h-[66px] w-[208px] flex-col items-start rounded-[10px] px-[14px] py-[12px] text-left"
              : "flex size-12 items-center justify-center self-center rounded-[10px]"
          }`}
        >
          {expanded ? (
            <>
              <span className="flex w-full items-center justify-between">
                <strong className="text-base font-bold text-ink">
                  구마구마
                </strong>
                <span className="flex size-[18px] items-center justify-center rounded-[3px] border border-field-border text-[#84968E]">
                  <Pencil aria-hidden className="size-3" strokeWidth={1.8} />
                </span>
              </span>
              <span className="mt-0.5 truncate text-[13px] font-medium text-ink-muted">
                못난이 농산물 간편식 서비스
              </span>
            </>
          ) : (
            <span className="text-base font-bold text-black">구</span>
          )}
        </button>

        <nav
          aria-label="주요 메뉴"
          className={`mt-8 ${expanded ? "w-[208px]" : "w-12 self-center"}`}
        >
          <ul>
            {navigation.map((item) => {
              const selected =
                item.key === "calendar" ? calendarActive : item.key === active;

              return (
                <li key={item.key}>
                  <Link
                    to={item.to}
                    aria-current={selected ? "page" : undefined}
                    title={expanded ? undefined : item.label}
                    className={`flex h-[46px] items-center rounded-lg text-[#84968E] transition-colors hover:bg-item-hover hover:text-[#596963] ${
                      expanded ? "gap-[10px] px-[13px]" : "justify-center"
                    } ${
                      selected
                        ? "bg-item-hover-selected font-bold text-brand hover:bg-item-hover-selected hover:text-brand"
                        : "font-medium"
                    }`}
                  >
                    <NavigationIcon src={item.icon} />
                    {expanded && (
                      <span className="whitespace-nowrap text-base">
                        {item.label}
                      </span>
                    )}
                  </Link>

                  {item.key === "calendar" && expanded && calendarActive && (
                    <Link
                      to="/calendar/growth-journal"
                      aria-current={
                        active === "growth-journal" ? "page" : undefined
                      }
                      className="relative flex h-[46px] items-start pl-12 pt-[5px]"
                    >
                      <span
                        aria-hidden
                        className="mt-[2px] h-6 w-px shrink-0 bg-field-border"
                      />
                      <span
                        className={`ml-[5px] flex h-7 w-[154px] items-center rounded-[7px] px-[10px] text-sm ${
                          active === "growth-journal"
                            ? "bg-[#EAF1EC] font-semibold text-brand"
                            : "font-medium text-[#73807A] hover:bg-item-hover"
                        }`}
                      >
                        성장일지
                      </span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
