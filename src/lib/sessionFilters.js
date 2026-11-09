// sessionStorage prefix of the list filters remembered per user and stage
// (see hooks/useSessionState.js). Cleared on logout; also gone when the browser tab closes.
export const SESSION_FILTERS_PREFIX = "sss_filters_";

export function clearSessionFilters() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(SESSION_FILTERS_PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
