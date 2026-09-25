const STORAGE_PREFIX = "ssiatmates:support-filter:";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function getSupportFilterSession(userId: string): string[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string")) {
      return null;
    }
    return parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

export function setSupportFilterSession(userId: string, categories: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(storageKey(userId), JSON.stringify(categories));
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
