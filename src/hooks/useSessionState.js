import { useCallback, useEffect, useRef, useState } from "react";
import useAuthStore from "../store/authStore";
import { SESSION_FILTERS_PREFIX } from "../lib/sessionFilters";

// useState that survives re-renders, remounts and a page refresh for the life of the
// browser tab: the value is mirrored to sessionStorage under
//   `${SESSION_FILTERS_PREFIX}${uid}_${stage}_${name}`
// Used for list filters / search / tab so processing a record does not reset them.
// Storage access is try/catch — if it is blocked this behaves like plain useState.
// `validate(saved)` can reject a stale value (it then falls back to `initial`).
const read = (storageKey, initial, validate) => {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw !== null) {
      const saved = JSON.parse(raw);
      if (!validate || validate(saved)) return saved;
    }
  } catch {
    /* corrupt or unavailable */
  }
  return initial;
};

export function useSessionState(stage, name, initial, validate) {
  const user = useAuthStore((s) => s.user);
  const uid = user?.id || user?.username || "guest";
  const storageKey = `${SESSION_FILTERS_PREFIX}${uid}_${stage}_${name}`;

  const initialRef = useRef(initial);
  const validateRef = useRef(validate);
  const [value, setValue] = useState(() => read(storageKey, initialRef.current, validateRef.current));

  // The user can resolve after the first render: re-read when the key changes.
  const lastKey = useRef(storageKey);
  useEffect(() => {
    if (lastKey.current !== storageKey) {
      lastKey.current = storageKey;
      setValue(read(storageKey, initialRef.current, validateRef.current));
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [storageKey, value]);

  const set = useCallback((v) => setValue(v), []);
  return [value, set];
}
