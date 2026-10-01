import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { AppSidebarProvider } from "../components/app/AppSidebarState";
import { AppShell } from "../components/app/AppShell";
import type { AppNavigationKey } from "../components/app/AppSidebar";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { AuthGate } from "@/components/auth/AuthGate";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-normal text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-normal text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-normal text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "씨앗" },
      { name: "description", content: "지원사업 매칭부터 일정 관리까지, 사업의 다음 단계를 준비하세요." },
      { name: "author", content: "씨앗" },
      { property: "og:title", content: "씨앗 | 지원사업 관리 서비스" },
      { property: "og:description", content: "지원사업 매칭부터 일정 관리까지, 사업의 다음 단계를 준비하세요." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@ssiatmates" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function getAppNavigationKey(pathname: string): AppNavigationKey | null {
  if (pathname === "/myhome") return "home";
  if (pathname === "/programs") return "programs";
  if (pathname === "/my-programs") return "my-programs";
  if (pathname === "/calendar/growth-journal") return "growth-journal";
  if (pathname === "/calendar" || pathname === "/calendar/") return "calendar";
  return null;
}

function AuthBackgroundOverlay({ pathname }: { pathname: string }) {
  const isAuthPage = pathname === "/" || pathname === "/signup";
  const [rendered, setRendered] = useState(isAuthPage);

  useEffect(() => {
    if (isAuthPage) {
      setRendered(true);
      return;
    }

    const timer = window.setTimeout(() => setRendered(false), 200);
    return () => window.clearTimeout(timer);
  }, [isAuthPage]);

  if (!rendered) return null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-[5] bg-overlay backdrop-blur-[2px] transition-opacity duration-200 ease-out ${isAuthPage ? "opacity-100" : "opacity-0"}`}
    />
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const activeNavigation = getAppNavigationKey(pathname);
  const routeContent = <Outlet />;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppSidebarProvider>
            <Toaster position="bottom-right" duration={3000} />
            <AuthBackgroundOverlay pathname={pathname} />
            <AuthGate pathname={pathname}>
              {activeNavigation ? (
                <AppShell active={activeNavigation}>{routeContent}</AppShell>
              ) : (
                routeContent
              )}
            </AuthGate>
          </AppSidebarProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
