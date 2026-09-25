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
import { clearSupportFilterSession } from "@/lib/supportFilterSession";

export interface Profile {
  id: string;
  username: string | null;
  is_onboarded: boolean;
  business_name: string | null;
  birth_date: string | null;
  startup_stage: string | null;
  residence: string | null;
  business_location: string | null;
  business_fields: string[];
  support_categories: string[];
  personal_statuses: string[];
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

export function getDisplayName(
  user: User | null,
  profile: Pick<Profile, "username"> | null,
): string {
  const name = profile?.username?.trim() || (user ? displayNameOf(user) : null) || "사용자";
  return name.endsWith("님") ? name : `${name}님`;
}

export function getProfileTitle(
  user: User | null,
  profile: Pick<Profile, "username" | "business_name"> | null,
): string {
  const businessName = profile?.business_name?.trim();
  return businessName || getDisplayName(user, profile);
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
  if (data) {
    let baseProfile = data;

    if (!baseProfile.username) {
      const fallbackUsername = displayNameOf(user);
      if (fallbackUsername) {
        const { data: updated } = await supabase
          .from("profiles")
          .update({ username: fallbackUsername })
          .eq("id", user.id)
          .select("id, username, is_onboarded")
          .maybeSingle();

        baseProfile = updated ?? baseProfile;
      }
    }

    const { data: onboarding, error: onboardingError } = await supabase
      .from("onboarding_profiles")
      .select(
        "birth_date, business_name, founding_stage, residence_region, business_region, industries, personal_statuses, support_interests",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (onboardingError) {
      console.error("[auth] 온보딩 프로필 조회 실패", onboardingError);
    }

    const regionCodes = [onboarding?.residence_region, onboarding?.business_region].filter(
      (value): value is string => Boolean(value),
    );
    const { data: regions } = regionCodes.length
      ? await supabase
          .from("onboarding_regions")
          .select("region_code, region_name")
          .in("region_code", regionCodes)
      : { data: [] as Array<{ region_code: string; region_name: string }> };
    const regionNames = new Map(
      (regions ?? []).map((region) => [region.region_code, region.region_name]),
    );

    return {
      id: baseProfile.id,
      username: baseProfile.username,
      is_onboarded: baseProfile.is_onboarded,
      business_name: onboarding?.business_name ?? null,
      birth_date: onboarding?.birth_date ?? null,
      startup_stage: onboarding?.founding_stage ?? null,
      residence: onboarding?.residence_region
        ? regionNames.get(onboarding.residence_region) ?? onboarding.residence_region
        : null,
      business_location: onboarding?.business_region
        ? regionNames.get(onboarding.business_region) ?? onboarding.business_region
        : null,
      business_fields: onboarding?.industries ?? [],
      support_categories: onboarding?.support_interests ?? [],
      personal_statuses: onboarding?.personal_statuses ?? [],
    };
  }

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: user.id, username: displayNameOf(user), is_onboarded: false })
    .select("id, username, is_onboarded")
    .maybeSingle();

  if (insertError) {
    console.error("[auth] profile 생성 실패", insertError);
    return null;
  }
  if (!created) return null;
  return {
    id: created.id,
    username: created.username,
    is_onboarded: created.is_onboarded,
    business_name: null,
    birth_date: null,
    startup_stage: null,
    residence: null,
    business_location: null,
    business_fields: [],
    support_categories: [],
    personal_statuses: [],
  };
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
    clearSupportFilterSession(session?.user.id);
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, [session?.user.id]);

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
