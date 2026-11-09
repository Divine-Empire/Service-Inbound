import { useState, useEffect, useMemo } from "react";
import { useColumnPrefs } from "./useColumnPrefs";
import { useSessionState } from "./useSessionState";

// The UI half of useStageList for pages whose data is still loaded in the browser
// (one fetch, then Pending / History split in JS). It returns the SAME shape, so a page
// moves to server paging later by swapping this hook for useStageList — the toolbar,
// table and columns do not change.
//
//   const list = useClientList({
//     key: "warehouse",                       // localStorage key for the column choice
//     data: { pending: pendingRows, history: historyRows },
//     loading: fetchLoading, error: loadError, onRetry: fetchData,
//     tabLabels: { pending: "Pending", history: "History" },
//     searchKeys: ["ticketId", "clientName", "companyName", "phoneNumber"],  // or (row) => string
//     filters: [{ key: "priority", label: "Priority", allLabel: "All Priorities",
//                 get: (row) => row.priority, tabs: ["history"] }],
//     columns: [{ key, label, defaultVisible, fixed, tabs, cell(row, {tab}), text(row), strong }],
//     sort: "reverse",                        // rows arrive oldest-first; show newest first
//   })
//
// Tab counts are the full tab sizes (like the server version), not the filtered size.
export { PAGE_SIZES } from "./useStageList";

const norm = (v) => String(v ?? "").toLowerCase();

// A filter with `multi: true` holds an array of selected values ([] = no filter); others hold "all" or a value.
export const emptyFilter = (f) => (f.multi ? [] : "all");
export const isFilterActive = (f, v) => (f.multi ? Array.isArray(v) && v.length > 0 : !!v && v !== "all");

export function useClientList({
  key,
  data,
  loading = false,
  error = null,
  onRetry,
  tabLabels = { pending: "Pending", history: "History" },
  searchKeys = [],
  filters: filterSpec = [],
  columns = [],
  sort = "reverse",
  defaultPageSize = 20,
  initialTab = Object.keys(data)[0],
}) {
  const tabIds = Object.keys(data);
  // Tab, search, filters and page size are remembered for the browser tab (sessionStorage),
  // per user and stage, so a refetch / remount after processing a record keeps them.
  const emptyFilters = () => Object.fromEntries(filterSpec.map((f) => [f.key, emptyFilter(f)]));
  const [tab, setTabState] = useSessionState(key, "tab", initialTab, (v) => tabIds.includes(v));
  const [search, setSearchState] = useSessionState(key, "search", "", (v) => typeof v === "string");
  const [filterValues, setFilterValues] = useSessionState(key, "filters", emptyFilters(), (v) =>
    v && typeof v === "object" && filterSpec.every((f) => (f.multi ? Array.isArray(v[f.key]) : typeof v[f.key] === "string"))
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useSessionState(key, "pageSize", defaultPageSize, (v) => Number.isInteger(v) && v > 0);

  const resetPage = () => setPage(1);
  const setTab = (t) => { setTabState(t); resetPage(); };
  const setSearch = (v) => { setSearchState(v); resetPage(); };
  const setFilter = (k, v) => { setFilterValues({ ...filterValues, [k]: v }); resetPage(); };
  const setPageSize = (n) => { setPageSizeState(n); resetPage(); };
  const clearAll = () => {
    setSearchState("");
    setFilterValues(emptyFilters());
    resetPage();
  };

  // ── data ────────────────────────────────────────────────────────────────
  const activeFilters = filterSpec.filter((f) => !f.tabs || f.tabs.includes(tab));
  const source = data[tab] || [];

  const filtered = useMemo(() => {
    const q = norm(search).trim();
    const matches = typeof searchKeys === "function"
      ? (row) => searchKeys(row).some((v) => norm(v).includes(q))
      : (row) => searchKeys.some((k) => norm(row[k]).includes(q));
    let rows = source.filter((row) => {
      if (q && !matches(row)) return false;
      for (const f of activeFilters) {
        const v = filterValues[f.key];
        if (f.multi) {
          if (Array.isArray(v) && v.length > 0 && !v.includes(String(f.get(row) ?? ""))) return false;
        } else if (v && v !== "all" && String(f.get(row) ?? "") !== v) return false;
      }
      return true;
    });
    if (typeof sort === "function") rows = [...rows].sort(sort);
    else if (sort === "reverse") rows = [...rows].reverse();
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, search, filterValues, tab, sort]);

  const filterOptions = Object.fromEntries(
    filterSpec.map((f) => {
      const all = tabIds.flatMap((t) => (!f.tabs || f.tabs.includes(t) ? data[t] || [] : []));
      return [f.key, Array.from(new Set(all.map((r) => f.get(r)).filter((v) => v !== "" && v != null).map(String))).sort()];
    })
  );

  // A remembered value that no longer exists in the data (its rows were all processed) would
  // leave a hidden filter on an empty list — drop it once the data has loaded.
  useEffect(() => {
    if (loading || tabIds.every((t) => (data[t] || []).length === 0)) return;
    let changed = false;
    const next = { ...filterValues };
    for (const f of filterSpec) {
      const opts = filterOptions[f.key] || [];
      const v = filterValues[f.key];
      if (f.multi) {
        const kept = (v || []).filter((x) => opts.includes(x));
        if (kept.length !== (v || []).length) { next[f.key] = kept; changed = true; }
      } else if (v && v !== "all" && !opts.includes(v)) {
        next[f.key] = "all";
        changed = true;
      }
    }
    if (changed) setFilterValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading]);

  const total = filtered.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  // Keep the page in range if the data shrank underneath us (e.g. after a submit).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  // ── columns ─────────────────────────────────────────────────────────────
  // Visible-column choice is remembered per user, stage and tab (see useColumnPrefs).
  const { columnPanel, activeColumns } = useColumnPrefs({ stageKey: key, tab, columns });

  const chips = [
    ...(search.trim() ? [{ key: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") }] : []),
    ...activeFilters
      .filter((f) => isFilterActive(f, filterValues[f.key]))
      .map((f) => ({
        key: f.key,
        label: `${f.label}: ${f.multi ? filterValues[f.key].join(", ") : filterValues[f.key]}`,
        onRemove: () => setFilter(f.key, emptyFilter(f)),
      })),
  ];

  const tabs = tabIds.map((id) => ({ id, label: tabLabels[id] ?? id, count: (data[id] || []).length }));

  return {
    tab, setTab, tabs,
    search, setSearch,
    filterSpec: activeFilters, filterValues, setFilter, filterOptions, chips, clearAll,
    page, setPage, pageSize, setPageSize, totalPages, total,
    allFiltered: filtered, // every row matching search/filters, for Export CSV
    rows,
    loading,
    fetching: loading,
    error,
    retry: onRetry,
    columnPanel,
    activeColumns,
  };
}
