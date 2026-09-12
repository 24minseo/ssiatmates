import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";

import { useAppSidebar } from "./AppSidebarState";

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

function NavigationIcon({
  src,
  selected,
}: {
  src: string;
  selected: boolean;
}) {
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
      className={`size-6 shrink-0 ${selected ? "bg-brand" : "bg-current"}`}
      style={maskStyle}
    />
  );
}

export function AppSidebar({ active }: AppSidebarProps) {
  const { expanded, toggleSidebar } = useAppSidebar();
  const calendarActive = active === "calendar" || active === "growth-journal";
  const growthJournalVisible = expanded && calendarActive;

  return (
    <aside
      className={`sticky top-0 z-30 h-screen shrink-0 bg-[#F6F8F7] transition-[width] duration-200 ease-out motion-reduce:transition-none ${
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
              className="h-[26px] w-8 object-contain"
            />
          )}
        </div>

        <button
          type="button"
          aria-label={expanded ? "사이드바 접기" : "사이드바 펼치기"}
          aria-expanded={expanded}
          onClick={toggleSidebar}
          className={`group/toggle absolute top-5 flex size-8 items-center justify-center transition-[right] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none ${
            expanded ? "right-[14px]" : "-right-[15px]"
          }`}
        >
          <img
            src={
              expanded
                ? "/assets/sidebar/sidebar-toggle-collapse.svg"
                : "/assets/sidebar/sidebar-toggle-expand.svg"
            }
            alt=""
            className={`absolute transition-opacity duration-150 ease-out group-hover/toggle:opacity-0 motion-reduce:transition-none ${
              expanded ? "size-8" : "size-[30px]"
            }`}
          />
          <img
            src={
              expanded
                ? "/assets/sidebar/sidebar-toggle-collapse-hover.svg"
                : "/assets/sidebar/sidebar-toggle-expand-hover.svg"
            }
            alt=""
            className={`absolute opacity-0 transition-opacity duration-150 ease-out group-hover/toggle:opacity-100 motion-reduce:transition-none ${
              expanded ? "size-8" : "size-[30px]"
            }`}
          />
        </button>

        <button
          type="button"
          aria-label="현재 프로젝트 정보 수정"
          className={`bg-[#FEFEFE] shadow-[1px_1px_0_1px_rgba(185,201,194,0.25)] ${
            expanded
              ? "absolute left-4 top-[79px] flex h-[65px] w-[208px] flex-col items-start gap-[2px] rounded-[10px] px-[14px] py-[13px] text-left"
              : "mt-[27px] flex size-12 items-center justify-center self-center rounded-[10px]"
          }`}
        >
          {expanded ? (
            <>
              <span className="flex w-full items-center justify-between">
                <strong className="text-base font-bold text-ink">
                  구마구마
                </strong>
                <span className="group/edit relative size-[18px] shrink-0">
                  <img
                    src="/assets/sidebar/profile-edit-default.svg"
                    alt=""
                    className="absolute inset-0 size-[18px] transition-opacity duration-150 ease-out group-hover/edit:opacity-0 motion-reduce:transition-none"
                  />
                  <img
                    src="/assets/sidebar/profile-edit-hover.svg"
                    alt=""
                    className="absolute inset-0 size-[18px] opacity-0 transition-opacity duration-150 ease-out group-hover/edit:opacity-100 motion-reduce:transition-none"
                  />
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
          className={`mt-8 transition-[width] duration-200 ease-out motion-reduce:transition-none ${
            expanded ? "w-[208px]" : "w-12"
          }`}
        >
          <ul>
            {navigation.map((item) => {
              const selected =
                item.key === "calendar" ? calendarActive : item.key === active;

              return (
                <li key={item.key}>
                  <Link
                    to={item.to}
                    aria-current={item.key === active ? "page" : undefined}
                    aria-label={expanded ? undefined : item.label}
                    title={expanded ? undefined : item.label}
                    className={`flex h-[46px] items-center overflow-hidden rounded-lg text-icon-muted transition-[gap,padding,background-color,color,box-shadow] duration-200 ease-out motion-reduce:transition-none ${
                      expanded
                        ? "gap-[10px] pl-[13px] pr-[19px]"
                        : "gap-0 px-3"
                    } ${
                      selected
                        ? "bg-pill font-bold text-pill-foreground hover:bg-pill hover:text-pill-foreground"
                        : "font-medium hover:bg-menu-hover hover:shadow-menu-hover"
                    }`}
                  >
                    <NavigationIcon src={item.icon} selected={selected} />
                    <span
                      aria-hidden={!expanded}
                      className={`overflow-hidden whitespace-nowrap text-base transition-[max-width,opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
                        expanded
                          ? "max-w-[160px] translate-x-0 opacity-100"
                          : "max-w-0 -translate-x-1 opacity-0"
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>

                  {item.key === "calendar" && (
                    <Link
                      to="/calendar/growth-journal"
                      aria-current={
                        active === "growth-journal" ? "page" : undefined
                      }
                      aria-hidden={!growthJournalVisible}
                      tabIndex={growthJournalVisible ? undefined : -1}
                      className={`relative flex items-start overflow-hidden pl-12 pt-[5px] transition-[height,opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
                        growthJournalVisible
                          ? "h-[46px] translate-x-0 opacity-100"
                          : "pointer-events-none h-0 -translate-x-1 opacity-0"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="mt-[2px] h-6 w-px shrink-0 bg-field-border"
                      />
                      <span
                        className={`ml-[5px] flex h-7 w-[154px] items-center rounded-[7px] px-[10px] text-sm ${
                          active === "growth-journal"
                            ? "bg-item-hover-selected font-semibold text-brand"
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
