import { supabase } from './supabase/client';
import { fetchAllRows } from './fetchAllRows';

// Server half of every list page: one page of a flat SQL view per request.
// The list views (Database/ migrations) expose the row's columns plus a lower-cased
// `search_text` and the flat filter columns, so search and filters run in SQL and
// `count: 'exact'` is the true total (no 1000-row cap, no giant `.in(...)` URLs).
//
// `idColumn` (default 'id') is the unique tiebreaker that keeps paging stable and
// `searchColumn` (default 'search_text') is what search matches; both are options so the
// same code can be pointed at a plain table while its view does not exist yet.

// % and _ are LIKE wildcards; escape them so "5%" searches the literal text.
const likeTerm = (s) => s.toLowerCase().replace(/\\/g, '').replace(/[%_]/g, (m) => `\\${m}`);

// Values inside or=(...) are double-quoted so commas / parentheses cannot break out.
const quote = (v) => `"${String(v).replace(/[\\"]/g, '')}"`;

/**
 * Role scope: a case-insensitive match of any of `columns` against any of `values`.
 * Returns a query modifier. With no usable value it matches nothing (fail closed).
 */
export function scopeBy(columns, values, idColumn = 'id') {
  const vals = values.filter(Boolean);
  if (!vals.length) return (q) => q.or(`${idColumn}.is.null`); // id is never null: matches nothing
  const expr = columns.flatMap((c) => vals.map((v) => `${c}.ilike.${quote(v.replace(/[%_]/g, ''))}`)).join(',');
  return (q) => q.or(expr);
}

function applyCommon(q, { filters = {}, search = '', searchColumn = 'search_text', scope, extra }) {
  if (scope) q = scope(q);
  if (extra) q = extra(q);
  for (const [col, val] of Object.entries(filters)) if (val && val !== 'all') q = q.eq(col, val);
  if (search.trim()) q = q.ilike(searchColumn, `%${likeTerm(search.trim())}%`);
  return q;
}

/**
 * One page of `view`.
 *  filters:  { column: value }  equality filters; '' / 'all' = none
 *  scope:    modifier from scopeBy(), applied to every query
 *  extra:    any other query modifier, e.g. (q) => q.gte('created_at', from) for a date range
 *  order:    [{ column, ascending }]
 */
export async function fetchViewPage(
  view,
  {
    page, pageSize, search = '', filters = {}, scope, extra,
    order = [{ column: 'created_at', ascending: false }],
    idColumn = 'id', searchColumn = 'search_text',
  }
) {
  let q = supabase.from(view).select('*', { count: 'exact' });
  q = applyCommon(q, { filters, search, searchColumn, scope, extra });
  for (const o of order) q = q.order(o.column, { ascending: o.ascending ?? true });
  q = q.order(idColumn);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await q.range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: data || [], total: count ?? 0 };
}

/**
 * Every row matching the same search / filters (CSV export). Pages through the view in
 * 1000-row chunks, so it is complete even past PostgREST's default cap.
 */
export async function fetchViewAll(
  view,
  { search = '', filters = {}, scope, extra, order = [{ column: 'created_at', ascending: false }], idColumn = 'id', searchColumn = 'search_text' }
) {
  const { data, error } = await fetchAllRows(() => {
    let q = supabase.from(view).select('*');
    q = applyCommon(q, { filters, search, searchColumn, scope, extra });
    for (const o of order) q = q.order(o.column, { ascending: o.ascending ?? true });
    return q.order(idColumn);
  });
  if (error) throw error;
  return data;
}

/** Exact row count of a view (tab badges). */
export async function countView(view, { scope, extra, idColumn = 'id' } = {}) {
  let q = supabase.from(view).select(idColumn, { count: 'exact', head: true });
  if (scope) q = scope(q);
  if (extra) q = extra(q);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

/** Distinct non-empty values of one column across the WHOLE view (filter dropdown options). */
export async function distinctValues(view, column, { scope, idColumn = 'id' } = {}) {
  const { data: rows, error } = await fetchAllRows(() => {
    let q = supabase.from(view).select(column).not(column, 'is', null).order(column).order(idColumn);
    if (scope) q = scope(q);
    return q;
  });
  if (error) throw error;
  return Array.from(new Set(rows.map((r) => r[column]).filter((v) => v !== '' && v != null))).sort();
}
