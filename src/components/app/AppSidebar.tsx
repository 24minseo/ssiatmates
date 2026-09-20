import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";

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

type AppRoute =
  | "/myhome"
  | "/programs"
  | "/my-programs"
  | "/calendar"
  | "/calendar/growth-journal";

type NavigationChild = {
  key: AppNavigationKey;
  label: string;
  to: AppRoute;
};

type NavigationItem = {
  key: Exclude<AppNavigationKey, "growth-journal">;
  label: string;
  to: AppRoute;
  icon: string;
  children?: NavigationChild[];
};

const navigation: NavigationItem[] = [
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
    children: [
      {
        key: "growth-journal",
        label: "성장일지",
        to: "/calendar/growth-journal",
      },
    ],
  },
];

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

function MenuItem({
  item,
  active,
  expanded,
}: {
  item: NavigationItem;
  active: AppNavigationKey;
  expanded: boolean;
}) {
  const isCurrent = item.key === active;
  const hasActiveChild = item.children?.some((child) => child.key === active) ?? false;
  const activeBranch = isCurrent || hasActiveChild;
  const [childrenCanEnter, setChildrenCanEnter] = useState(false);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [flyoutHoveredKey, setFlyoutHoveredKey] = useState<AppNavigationKey | null>(null);
  const flyoutCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openFlyout = () => {
    if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current);
    setFlyoutOpen(true);
  };
  const scheduleFlyoutClose = () => {
    if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current);
    flyoutCloseTimer.current = setTimeout(() => {
      setFlyoutHoveredKey(null);
      setFlyoutOpen(false);
    }, 80);
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setChildrenCanEnter(true);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  const childrenVisible = expanded && activeBranch && childrenCanEnter;

  return (
    <li className="relative">
      <Link
        to={item.to}
        aria-current={isCurrent ? "page" : undefined}
        aria-label={expanded ? undefined : item.label}
        onMouseEnter={openFlyout}
        onMouseLeave={scheduleFlyoutClose}
        className={`flex h-[46px] items-center gap-[10px] overflow-hidden rounded-lg pl-3 transition-[padding,background-color,color,box-shadow] duration-200 ease-out motion-reduce:transition-none ${
          expanded ? "pr-[19px]" : "pr-3"
        } ${
          isCurrent
            ? "bg-item-hover-selected font-semibold text-brand"
            : hasActiveChild
              ? expanded
                ? "font-semibold text-brand hover:bg-menu-hover hover:shadow-menu-hover"
                : "bg-item-hover-selected font-semibold text-brand"
              : "font-normal text-icon-muted hover:bg-menu-hover hover:shadow-menu-hover"
        }`}
      >
        <NavigationIcon src={item.icon} selected={activeBranch} />
        <span
          aria-hidden={!expanded}
          className={`overflow-hidden whitespace-nowrap text-base transition-[max-width,opacity,color] duration-100 ease-out motion-reduce:transition-none ${
            activeBranch ? "text-brand" : "text-icon-muted"
          } ${
            expanded ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
          }`}
        >
          {item.label}
        </span>
      </Link>

      {item.children?.map((child) => {
        const childSelected = child.key === active;

        return (
          <Link
            key={child.key}
            to={child.to}
            aria-current={childSelected ? "page" : undefined}
            aria-hidden={!childrenVisible}
            tabIndex={childrenVisible ? undefined : -1}
            className={`group/submenu relative flex items-start overflow-hidden pl-12 pt-[2px] transition-[height,opacity] duration-100 ease-out motion-reduce:transition-none ${
              childrenVisible
                ? "h-[46px] opacity-100"
                : "pointer-events-none h-0 opacity-0"
            }`}
          >
            <span
              aria-hidden
              className="mt-[3px] h-[22px] w-[2px] shrink-0 rounded-full bg-field-border"
            />
            <span
              className={`ml-[5px] flex h-7 w-[154px] shrink-0 items-center overflow-hidden whitespace-nowrap rounded-[7px] px-[10px] text-sm ${
                childSelected
                  ? "bg-item-hover-selected font-semibold text-brand"
                  : "font-normal text-submenu-text group-hover/submenu:bg-menu-hover group-hover/submenu:shadow-menu-hover"
              }`}
            >
              {child.label}
            </span>
          </Link>
        );
      })}

      {!expanded && flyoutOpen && item.children ? (
        <div
          onMouseEnter={openFlyout}
          onMouseLeave={scheduleFlyoutClose}
          className="before:absolute before:-left-2 before:top-0 before:h-9 before:w-2 before:content-[''] relative absolute left-[56px] -top-[49px] z-50 w-[100px] rounded-[12px] bg-white p-1 shadow-dropdown">
          <Link
            to={item.to}
            aria-current={isCurrent ? "page" : undefined}
            onClick={() => {
              setFlyoutHoveredKey(null);
              setFlyoutOpen(false);
            }}
            className={isCurrent && (flyoutHoveredKey === null || flyoutHoveredKey === item.key) ? "flex h-9 items-center rounded-[7px] bg-[#F5F8F5] px-2 text-sm font-semibold text-brand hover:bg-[#F6F8F7]" : isCurrent ? "flex h-9 items-center rounded-[7px] px-2 text-sm font-semibold text-brand" : "flex h-9 items-center rounded-[7px] px-2 text-sm font-normal text-submenu-text hover:bg-[#F6F8F7] hover:shadow-menu-hover"}
            onMouseEnter={() => setFlyoutHoveredKey(item.key)}
          >
            {item.label}
          </Link>
          {item.children.map((child) => {
            const childSelected = child.key === active;

            return (
              <Link
                key={child.key}
                to={child.to}
                aria-current={childSelected ? "page" : undefined}
                onClick={() => {
                  setFlyoutHoveredKey(null);
                  setFlyoutOpen(false);
                }}
                className={childSelected && (flyoutHoveredKey === null || flyoutHoveredKey === child.key) ? "flex h-9 items-center rounded-[7px] bg-[#F5F8F5] px-2 text-sm font-semibold text-brand hover:bg-[#F6F8F7]" : childSelected ? "flex h-9 items-center rounded-[7px] px-2 text-sm font-semibold text-brand" : "flex h-9 items-center rounded-[7px] px-2 text-sm font-normal text-submenu-text hover:bg-[#F6F8F7] hover:shadow-menu-hover"}
                onMouseEnter={() => setFlyoutHoveredKey(child.key)}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </li>
  );
}

export function AppSidebar({ active }: AppSidebarProps) {
  const { expanded, toggleSidebar } = useAppSidebar();
  const projectName = "지역농산물간편식연구개발협동조합";
  const profileCardStatus = "기본 매칭 프로필";
  const [projectInitial = "", ...projectNameRest] = Array.from(projectName);

  return (
    <aside
      className={`sticky top-0 z-30 h-screen shrink-0 bg-[#F6F8F7] transition-[width] duration-200 ease-out motion-reduce:transition-none ${
        expanded ? "w-[240px]" : "w-20"
      }`}
    >
      <div className="relative h-full">
        <div className="absolute left-4 top-5 h-8 w-[135px] overflow-hidden">
          <img
            src="/assets/sidebar/ssiat-logo.svg"
            alt="SSIAT"
            aria-hidden={!expanded}
            className={`absolute left-[15px] top-1.5 h-5 w-[104px] ${
              expanded ? "opacity-100" : "opacity-0"
            }`}
          />
          <img
            src="/assets/sidebar/ssiat-symbol.svg"
            alt="SSIAT"
            aria-hidden={expanded}
            className={`absolute left-2 top-[3px] h-[26px] w-8 object-contain ${
              expanded ? "opacity-0" : "opacity-100"
            }`}
          />
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
            src="/assets/sidebar/sidebar-toggle-collapse.svg"
            alt=""
            className={`absolute size-8 transition-opacity duration-75 ease-out motion-reduce:transition-none ${
              expanded
                ? "opacity-100 group-hover/toggle:opacity-0"
                : "opacity-0"
            }`}
          />
          <img
            src="/assets/sidebar/sidebar-toggle-collapse-hover.svg"
            alt=""
            className={`absolute size-8 opacity-0 transition-opacity duration-75 ease-out motion-reduce:transition-none ${
              expanded ? "group-hover/toggle:opacity-100" : ""
            }`}
          />
          <img
            src="/assets/sidebar/sidebar-toggle-expand.svg"
            alt=""
            className={`absolute size-[30px] transition-opacity duration-75 ease-out motion-reduce:transition-none ${
              expanded
                ? "opacity-0"
                : "opacity-100 group-hover/toggle:opacity-0"
            }`}
          />
          <img
            src="/assets/sidebar/sidebar-toggle-expand-hover.svg"
            alt=""
            className={`absolute size-[30px] opacity-0 transition-opacity duration-75 ease-out motion-reduce:transition-none ${
              expanded ? "" : "group-hover/toggle:opacity-100"
            }`}
          />
        </button>

        <button
          type="button"
          aria-label="현재 프로젝트 정보 수정"
          className={`absolute left-4 top-[79px] overflow-hidden rounded-[10px] bg-[#FEFEFE] shadow-[1px_1px_0_1px_rgba(185,201,194,0.25)] transition-[width,height] duration-200 ease-out motion-reduce:transition-none ${
            expanded ? "h-[65px] w-[208px]" : "size-12"
          }`}
        >
          <strong
            className={`absolute top-[13px] whitespace-nowrap text-left text-[15px] font-semibold text-ink transition-[left] duration-200 ease-out motion-reduce:transition-none ${
              expanded ? "left-[14px]" : "left-[24px]"
            }`}
          >
            <span
              className={`relative inline-block transition-transform duration-200 ease-out motion-reduce:transition-none ${
                expanded ? "translate-x-0" : "-translate-x-1/2"
              }`}
            >
              <span>{projectInitial}</span>
              <span
                className={`absolute left-full top-0 block overflow-hidden whitespace-nowrap text-ellipsis ${
                  expanded
                    ? "max-w-[calc(154px-100%)] opacity-100 transition-[max-width,opacity] duration-200 ease-out motion-reduce:transition-none"
                    : "max-w-0 opacity-0 transition-none"
                }`}
              >
                {projectNameRest.join("")}
              </span>
            </span>
          </strong>

          <span
            aria-hidden={!expanded}
            className={`absolute inset-0 flex flex-col items-start gap-0 px-[14px] py-[13px] text-left ${
              expanded ? "" : "pointer-events-none"
            }`}
          >
            <span
              className={`relative h-6 w-full shrink-0 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
                expanded ? "opacity-100" : "opacity-0"
              }`}
            >
              <span className="group/edit absolute right-0 top-[2px] size-5">
                <img
                  src="/assets/sidebar/profile-edit-default.svg"
                  alt=""
                  className="absolute inset-0 size-5 transition-opacity duration-150 ease-out group-hover/edit:opacity-0 motion-reduce:transition-none"
                />
                <img
                  src="/assets/sidebar/profile-edit-hover.svg"
                  alt=""
                  className="absolute inset-0 size-5 opacity-0 transition-opacity duration-150 ease-out group-hover/edit:opacity-100 motion-reduce:transition-none"
                />
              </span>
            </span>
            <span
              className={`shrink-0 whitespace-nowrap text-xs font-normal leading-[18px] text-ink-muted ${
                expanded
                  ? "opacity-100 transition-opacity duration-200 ease-out motion-reduce:transition-none"
                  : "opacity-0 transition-none"
              }`}
            >
              {profileCardStatus}
            </span>
          </span>
        </button>

        <nav
          aria-label="주요 메뉴"
          className={`absolute left-4 top-[178px] transition-[width] duration-200 ease-out motion-reduce:transition-none ${
            expanded ? "w-[208px]" : "w-12"
          }`}
        >
          <ul>
            {navigation.map((item) => (
              <MenuItem
                key={item.key}
                item={item}
                active={active}
                expanded={expanded}
              />
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
