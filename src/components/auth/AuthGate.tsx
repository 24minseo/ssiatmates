import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useAuth } from "@/hooks/useAuth";

const AUTH_PAGES = ["/", "/signup"];
const MATCHING_ROUTE = "/programs";
const ONBOARDING_ROUTE = "/onboarding";

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F8F7]">
      <span
        aria-label="불러오는 중"
        role="status"
        className="size-8 animate-spin rounded-full border-2 border-field-border border-t-brand"
      />
    </div>
  );
}

/** 세션 확인이 끝난 뒤에만 화면을 노출하고, 상태에 맞는 라우트로 보냄 */
export function AuthGate({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const { loading, session, profile } = useAuth();
  const navigate = useNavigate();

  const isAuthPage = AUTH_PAGES.includes(pathname);
  const isOnboarding = pathname === ONBOARDING_ROUTE;

  let target: string | null = null;
  if (!loading) {
    if (!session && !isAuthPage) target = "/";
    else if (session && profile) {
      if (isAuthPage) target = profile.is_onboarded ? MATCHING_ROUTE : ONBOARDING_ROUTE;
      else if (!profile.is_onboarded && !isOnboarding) target = ONBOARDING_ROUTE;
      else if (profile.is_onboarded && isOnboarding) target = null;
    }
  }

  useEffect(() => {
    if (target) void navigate({ to: target, replace: true });
  }, [target, navigate]);

  if (loading || target) return <FullScreenLoader />;
  return <>{children}</>;
}
