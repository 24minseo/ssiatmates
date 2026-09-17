import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  username: string | null;
  is_onboarded: boolean;
}

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  refreshProfile: () => Promise<Profile | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function displayNameOf(user: User): string | null {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const candidate =
    (meta?.["full_name"] as string | undefined) ??
    (meta?.["name"] as string | undefined) ??
    (meta?.["username"] as string | undefined);
  return candidate ?? user.email?.split("@")[0] ?? null;
}

/** 현재 로그인 사용자의 profiles row를 보장(없으면 생성)하고 반환 */
async function ensureProfile(user: User): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, is_onboarded")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[auth] profile 조회 실패", error);
    return null;
  }
  if (data) return data as Profile;

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: user.id, username: displayNameOf(user), is_onboarded: false })
    .select("id, username, is_onboarded")
    .maybeSingle();

  if (insertError) {
    console.error("[auth] profile 생성 실패", insertError);
    return null;
  }
  return (created as Profile | null) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;

    const apply = async (next: Session | null) => {
      if (!active) return;
      setSession(next);
      if (next?.user) {
        const nextProfile = await ensureProfile(next.user);
        if (!active) return;
        setProfile(nextProfile);
      } else {
        setProfile(null);
      }
      if (active) setLoading(false);
    };

    void supabase.auth.getSession().then(({ data }) => {
      void apply(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "TOKEN_REFRESHED") {
        setSession(next);
        return;
      }
      // Supabase 콜백 안에서 직접 쿼리하지 않도록 다음 틱으로 미룸
      setTimeout(() => {
        void apply(next);
      }, 0);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setProfile(null);
      return null;
    }
    const next = await ensureProfile(data.user);
    setProfile(next);
    return next;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      refreshProfile,
      signOut,
    }),
    [loading, session, profile, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
