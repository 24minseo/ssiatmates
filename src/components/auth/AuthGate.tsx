import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";

import { useAuth } from "@/hooks/useAuth";
import { LoginPage } from "@/routes/index";
import { SignupPage } from "@/routes/signup";
import { runAuthTransition } from "@/components/auth/AuthLayout";

const AUTH_PAGES = ["/", "/signup"];
const PUBLIC_PAGES = ["/myhome", "/privacy", "/terms"];
const HOME_ROUTE = "/myhome";
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
export function AuthGate({ pathname, children }: { pathname: string; children: ReactNode }) {
  const { loading, session, profile } = useAuth();
  const navigate = useNavigate();

  const isAuthPage = AUTH_PAGES.includes(pathname);
  const isOnboarding = pathname === ONBOARDING_ROUTE;
  const isGrowthJournalComposer = pathname === "/calendar/growth-journal/new";
  const [authPromptRequested, setAuthPromptRequested] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  useEffect(() => {
    const request = () => {
      if (!window.history.state?.loginModal) {
        window.history.pushState({ ...window.history.state, loginModal: true }, "", window.location.href);
      }
      setAuthPromptRequested(true);
      setAuthMode("login");
    };
    const close = (event: PopStateEvent) => {
      if (authPromptRequested && !event.state?.loginModal) setAuthPromptRequested(false);
    };
    window.addEventListener("auth-required", request);
    window.addEventListener("popstate", close);
    return () => {
      window.removeEventListener("auth-required", request);
      window.removeEventListener("popstate", close);
    };
  }, [authPromptRequested]);
  const showLoginModal = !loading && !session && (!isAuthPage && !PUBLIC_PAGES.includes(pathname) || authPromptRequested);
  useEffect(() => {
    if (isAuthPage) setAuthPromptRequested(false);
  }, [isAuthPage]);

  let target: string | null = null;
  if (!loading) {
    // The home and legal pages are public. Moving to any other app route
    // requires an account and should show the login screen immediately.
    if (!session && !isAuthPage && !PUBLIC_PAGES.includes(pathname)) target = null;
    else if (session && profile) {
      if (isAuthPage) target = profile.is_onboarded ? HOME_ROUTE : ONBOARDING_ROUTE;
      else if (!profile.is_onboarded && !isOnboarding) target = ONBOARDING_ROUTE;
      else if (profile.is_onboarded && isOnboarding) target = null;
    }
  }

  useEffect(() => {
    if (target) void navigate({ to: target, replace: true });
  }, [target, navigate]);

  // Keep the composer visible while the existing session is being restored.
  // Otherwise a full route entry can remain on the spinner even though the
  // editor itself is ready to render.
  if ((loading && !isGrowthJournalComposer) || target) return <FullScreenLoader />;
  return (
    <>
      {children}
      {showLoginModal && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[2147483647]">
              {authMode === "login" ? (
                <LoginPage modal includeBackground={false} onSwitchToSignup={() => runAuthTransition(() => setAuthMode("signup"))} />
              ) : (
                <SignupPage modal onSwitchToLogin={() => runAuthTransition(() => setAuthMode("login"))} />
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
