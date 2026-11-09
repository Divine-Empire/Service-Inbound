// localStorage prefix of the per-user list-column choices (see hooks/useColumnPrefs.js).
export const COLUMN_PREFS_PREFIX = "sss_cols_";

// Logout: forget every user's saved column choices.
export function clearColumnPrefs() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(COLUMN_PREFS_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
