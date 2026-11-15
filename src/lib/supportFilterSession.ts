const STORAGE_PREFIX = "ssiatmates:support-filter:";

type MatchingProfile = {
  id: string;
  birth_date?: string | null;
  startup_stage?: string | null;
  residence?: string | null;
  business_location?: string | null;
  business_fields?: string[];
  personal_statuses?: string[];
  support_categories?: string[];
};

// A temporary list filter belongs to one saved matching profile, not just one user.
export function matchingProfileKey(profile: MatchingProfile): string {
  const values = (items?: string[]) => [...(items ?? [])].sort();
  return JSON.stringify([
    profile.id, profile.birth_date, profile.startup_stage, profile.residence,
    profile.business_location, values(profile.business_fields),
    values(profile.personal_statuses), values(profile.support_categories),
  ]);
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function getSupportFilterSession(userId: string, profileKey?: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // Old arrays have no profile identity. Do not restore them for a new profile.
    const entry = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as { categories?: unknown; profileKey?: unknown } : null;
    if (profileKey !== undefined && entry?.profileKey !== profileKey) return null;
    const categories = entry ? entry.categories : parsed;
    if (!Array.isArray(categories) || categories.some(value => typeof value !== "string")) return null;
    return categories.length ? categories : null;
  } catch {
    return null;
  }
}

export function setSupportFilterSession(userId: string, categories: string[], profileKey?: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(userId), JSON.stringify(
      profileKey === undefined ? categories : { categories, profileKey },
    ));
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

export function clearSupportFilterSession(userId: string | null | undefined) {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.sessionStorage.removeItem(storageKey(userId));
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}
