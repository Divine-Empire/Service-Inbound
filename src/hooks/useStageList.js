import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueries, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { fetchViewPage, countView, distinctValues } from "../lib/pagedView";
import { useDebounced } from "./useDebounced";
import { useColumnPrefs } from "./useColumnPrefs";

// One hook per Pending / History style list page (same role as Engineer's useStageList and
// OTP_Supabase's). It owns the UI state — tab, search, filters, page, page size, visible
// columns — and turns it into one server request per change. Nothing is fetched in bulk.
//
//   const list = useStageList({
//     key: "stage-name",
//     views: { pending: "<pending_view>", history: "<history_view>" },
//     tabLabels: { pending: "Pending", history: "History" },   // optional; any number of tabs
//     filters: [{ key: "category", column: "category", label: "Category", allLabel: "All Categories" }],
//     columns: [{ key: "ticketId", label: "Ticket ID", defaultVisible: true, fixed: false, tabs: ["history"] }],
//     order: { pending: [...], history: [...] },               // optional, see fetchViewPage
//   })
//
// - Search is debounced (350 ms); changing search / filter / tab resets to page 1.
// - Stale responses are dropped and the previous page stays on screen while the next loads.
// - Tab counts are exact view counts (cheap HEAD requests), so every badge is always right.
// - Filter dropdown options come from the whole view, not the loaded page.
// - `scope` / `extra` are query modifiers (role scope, date range ...); change `scopeKey` /
//   `extraKey` whenever they change so the cache follows.
// - idColumn / searchColumn default to the view convention (`id`, `search_text`).
export const PAGE_SIZES = [10, 20, 50, 100];

const DEFAULT_LABELS = { pending: "Pending", history: "History" };

export function useStageList({
  key,
  views,
  tabLabels = DEFAULT_LABELS,
  scope = null,
  scopeKey = "",
  extra = null,
  extraKey = "",
  filters: filterSpec = [],
  columns = [],
  order,
  defaultPageSize = 20,
  initialTab = Object.keys(views)[0],
  idColumn = "id",
  searchColumn = "search_text",
}) {
  const queryClient = useQueryClient();
  const tabIds = Object.keys(views);
  const [tab, setTabState] = useState(initialTab);
  const [search, setSearchState] = useState("");
  const [filterValues, setFilterValues] = useState(() => Object.fromEntries(filterSpec.map((f) => [f.key, "all"])));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);
  const debouncedSearch = useDebounced(search, 350);

  const resetPage = () => setPage(1);
  const setTab = (t) => { setTabState(t); resetPage(); };
  const setSearch = (v) => { setSearchState(v); resetPage(); };
  const setFilter = (k, v) => { setFilterValues((p) => ({ ...p, [k]: v })); resetPage(); };
  const setPageSize = (n) => { setPageSizeState(n); resetPage(); };
  const clearAll = () => {
    setSearchState("");
    setFilterValues(Object.fromEntries(filterSpec.map((f) => [f.key, "all"])));
    resetPage();
  };

  // ── data ────────────────────────────────────────────────────────────────
  const dbFilters = useMemo(
    () => Object.fromEntries(filterSpec.map((f) => [f.column, filterValues[f.key]])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterValues]
  );
  const view = views[tab];
  const pageQuery = useQuery({
    queryKey: ["list", key, tab, scopeKey, extraKey, page, pageSize, debouncedSearch, dbFilters],
    queryFn: () =>
      fetchViewPage(view, {
        page, pageSize, search: debouncedSearch, filters: dbFilters, scope, extra,
        order: order?.[tab], idColumn, searchColumn,
      }),
    placeholderData: keepPreviousData,
  });

  const countQueries = useQueries({
    queries: tabIds.map((t) => ({
      queryKey: ["count", key, t, scopeKey, extraKey],
      queryFn: () => countView(views[t], { scope, extra, idColumn }),
    })),
  });
  const facetQueries = useQueries({
    queries: filterSpec.map((f) => ({
      queryKey: ["facet", key, f.column, scopeKey],
      queryFn: async () => {
        const lists = await Promise.all(tabIds.map((t) => distinctValues(views[t], f.column, { scope, idColumn })));
        return Array.from(new Set(lists.flat())).sort();
      },
      staleTime: 5 * 60_000,
    })),
  });
  const filterOptions = Object.fromEntries(filterSpec.map((f, i) => [f.key, facetQueries[i].data || []]));

  // ── columns ─────────────────────────────────────────────────────────────
  // Visible-column choice is remembered per user, stage and tab (see useColumnPrefs).
  const { columnPanel, activeColumns } = useColumnPrefs({ stageKey: key, tab, columns });

  // ── derived ─────────────────────────────────────────────────────────────
  const total = pageQuery.data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  // Keep the page in range if the data shrank underneath us (e.g. after a submit).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const chips = [
    ...(debouncedSearch ? [{ key: "search", label: `Search: ${debouncedSearch}`, onRemove: () => setSearch("") }] : []),
    ...filterSpec
      .filter((f) => filterValues[f.key] && filterValues[f.key] !== "all")
      .map((f) => ({ key: f.key, label: `${f.label}: ${filterValues[f.key]}`, onRemove: () => setFilter(f.key, "all") })),
  ];

  const tabs = tabIds.map((id, i) => ({ id, label: tabLabels[id] ?? id, count: countQueries[i].data }));

  // After a submit: refresh the page, every count and the filter options.
  const reload = useCallback(
    () => queryClient.invalidateQueries({ predicate: (q) => ["list", "count", "facet"].includes(q.queryKey[0]) && q.queryKey[1] === key }),
    [queryClient, key]
  );

  // What the current tab is showing, for Export CSV (pair with fetchViewAll).
  const exportParams = {
    view, search: debouncedSearch, filters: dbFilters, scope, extra,
    order: order?.[tab], idColumn, searchColumn,
  };

  return {
    tab, setTab, tabs,
    search, setSearch,
    filterValues, setFilter, filterOptions, chips, clearAll,
    page, setPage, pageSize, setPageSize, totalPages, total,
    rows: pageQuery.data?.rows ?? [],
    loading: pageQuery.isPending,
    fetching: pageQuery.isFetching,
    error: pageQuery.error ? pageQuery.error.message || "Failed to load" : null,
    retry: () => pageQuery.refetch(),
    reload,
    exportParams,
    // props for the shared ColumnSelector: <ColumnSelector {...list.columnPanel} />
    columnPanel,
    activeColumns,
  };
}
