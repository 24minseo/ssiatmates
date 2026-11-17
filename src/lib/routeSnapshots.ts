// In-memory presentation snapshots only. Every visit still revalidates with the
// existing APIs; neither matching results nor browser storage are authoritative.
const snapshots = new Map<string, { value: unknown; at: number }>();
const pending = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 60;
const MAX_AGE_MS = 5 * 60_000;
let revision = 0;
let owner: string | null = null;

export function clearRouteSnapshots() {
  revision += 1;
  snapshots.clear();
  pending.clear();
}

export function setRouteSnapshotUser(userId: string | null) {
  if (owner !== userId) {
    clearRouteSnapshots();
    owner = userId;
  }
}

if (typeof window !== "undefined") {
  // Capture runs before mounted views start refreshing after a mutation.
  for (const event of ["saved-notices-changed", "calendar-events-changed", "matching-profile-saved"]) {
    window.addEventListener(event, clearRouteSnapshots, true);
  }
}

export async function refreshRouteSnapshot<T>(
  key: string,
  load: () => Promise<T>,
  apply: (value: T) => void,
  isCurrent: () => boolean,
) {
  const started = revision;
  const cached = snapshots.get(key);
  if (cached && Date.now() - cached.at < MAX_AGE_MS && isCurrent()) {
    apply(cached.value as T);
  }
  // Deduplicate simultaneous reads, not completed requests. A return visit
  // always checks the server, including empty lists and unchanged counts.
  let request = pending.get(key) as Promise<T> | undefined;
  if (!request) {
    request = Promise.resolve().then(load);
    pending.set(key, request);
  }
  try {
    const value = await request;
    if (!isCurrent()) return;
    if (started !== revision) {
      // A write completed while this read was in flight. Never publish the
      // pre-write response, even when several change events arrive together.
      return await refreshRouteSnapshot(key, load, apply, isCurrent);
    }
    // Never keep one user's data in a server process across HTTP requests.
    if (typeof window !== "undefined") {
      snapshots.delete(key);
      snapshots.set(key, { value, at: Date.now() });
      if (snapshots.size > MAX_ENTRIES) snapshots.delete(snapshots.keys().next().value!);
    }
    apply(value);
  } finally {
    if (pending.get(key) === request) pending.delete(key);
  }
}
