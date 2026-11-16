// Notify mounted views only after the saved state has been persisted.
export function notifySavedNoticesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("saved-notices-changed"));
  window.dispatchEvent(new Event("calendar-events-changed"));
  window.dispatchEvent(new Event("notifications-changed"));
}
