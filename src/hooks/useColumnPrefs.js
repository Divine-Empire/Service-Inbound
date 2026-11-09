import { useEffect, useState } from "react";
import useAuthStore from "../store/authStore";
import { COLUMN_PREFS_PREFIX } from "../lib/columnPrefs";

// Visible-column choice for a list page, remembered per user, stage and tab.
//
//   key   = `${COLUMN_PREFS_PREFIX}${uid}_${stage}_${tab}`      (tab = "pending" | "history" | ...)
//   value = { [columnKey]: boolean }               (the full map for that tab's columns)
//
// stage = the page's `key` || its pathname ("/" stripped, "/" -> "_") || "default_stage".
// uid   = user.id || user.username || "guest". The first render can run before the user is
//         known, so the saved map is re-read as soon as the key changes.
// Load merges over the defaults, so a column added later keeps its default instead of
// being lost to an older saved map. Storage access is try/catch: private windows or
// blocked storage just mean the choice is not remembered.
const defaultsFor = (cols) => Object.fromEntries(cols.map((c) => [c.key, c.defaultVisible !== false]));

function read(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) return saved;
  } catch {
    /* corrupt or unavailable — fall back to defaults */
  }
  return {};
}

export function useColumnPrefs({ stageKey, tab, columns }) {
  const user = useAuthStore((s) => s.user);
  const uid = user?.id || user?.username || "guest";
  const stage =
    stageKey ||
    window.location.pathname.replace(/^\//, "").replace(/\//g, "_") ||
    "default_stage";
  const storageKey = `${COLUMN_PREFS_PREFIX}${uid}_${stage}_${tab}`;

  const [saved, setSaved] = useState(() => read(storageKey));
  // Re-sync when the user (or tab) changes the key — e.g. the user loads after first render.
  useEffect(() => {
    setSaved(read(storageKey));
  }, [storageKey]);

  // Columns may be limited to a tab (`tabs: ['history']`); the panel lists only this tab's.
  const tabColumns = columns.filter((c) => !c.tabs || c.tabs.includes(tab));
  const defaults = defaultsFor(tabColumns);
  const state = { ...defaults, ...saved };

  const persist = (next) => {
    setSaved(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  const isVisible = (c) => c.fixed || !!state[c.key];
  const visibleKeys = tabColumns.filter(isVisible).map((c) => c.key);
  const toggleColumn = (k) => persist({ ...state, [k]: !state[k] });
  const resetColumns = () => persist(defaults);
  const activeColumns = tabColumns.filter(isVisible);

  return {
    activeColumns,
    columnPanel: { columns: tabColumns, visibleKeys, onToggle: toggleColumn, onReset: resetColumns },
  };
}
