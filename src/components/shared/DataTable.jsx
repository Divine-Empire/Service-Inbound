import React, { useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import DragScrollTable from './DragScrollTable';
import { EmptyState, ErrorState } from './TableStates';

/**
 * DataTable: the one list container. Desktop table + mobile card list inside a single card,
 * integrated pagination footer. Rows scroll inside the card under a sticky header.
 * Layout's <main> scrolls (not a fixed flex column like Engineer), so by default the card
 * measures itself and stretches to the bottom of <main>, whatever sits above it (one toolbar
 * row, filter chips ...), leaving no gap above the app footer. Pass `heightClass`
 * (e.g. "h-full min-h-0" inside a flex parent) to size it yourself instead.
 *
 * Callers own the rows (renderRow / renderCard) and the paging state (see useStageList).
 * loading   — skeleton rows (first load) while `data` is empty
 * error     — message string; shows ErrorState with `onRetry`
 * emptyTitle (+ emptyDescription / emptyAction) — shown when there are no rows
 */
const DataTable = ({
  headers,
  data,
  renderRow,
  renderCard,
  minWidth = 'min-w-[1000px]',
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  totalResults,
  itemsPerPageOptions = [10, 20, 50, 100],
  loading = false,
  error = null,
  onRetry,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyAction,
  ariaLabel = 'Data table',
  showFooter = true, // false for fixed-size "latest N" lists with no paging
  heightClass,
}) => {
  const cardRef = useRef(null);
  const [fitHeight, setFitHeight] = useState(null);
  const autoFit = !heightClass;

  // Height = the room left in <main> below the card's own top edge (scroll-independent).
  useLayoutEffect(() => {
    if (!autoFit) return undefined;
    const card = cardRef.current;
    const main = card?.closest('main');
    if (!card || !main) return undefined;
    const measure = () => {
      const top = card.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
      const bottomPad = parseFloat(getComputedStyle(main).paddingBottom) || 0;
      setFitHeight(Math.floor(main.clientHeight - bottomPad - top));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    if (card.parentElement) observer.observe(card.parentElement);
    return () => observer.disconnect();
  }, [autoFit]);

  const hasRows = data.length > 0;
  const showSkeleton = loading && !hasRows && !error;
  const showError = !!error && !hasRows;
  const showEmpty = !loading && !error && !hasRows;
  const stateNode = showError ? (
    <ErrorState message={error} onRetry={onRetry} />
  ) : showEmpty ? (
    <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
  ) : null;
  const pages = totalPages || 1;

  return (
    <div
      ref={cardRef}
      className={`flex w-full flex-col overflow-hidden rounded-lg border border-brand-200 bg-card shadow-sm ${autoFit ? 'min-h-[420px]' : heightClass}`}
      style={autoFit && fitHeight ? { height: Math.max(fitHeight, 420) } : undefined}
      aria-busy={loading}
    >
      {/* Mobile card list */}
      <div
        role="region"
        aria-label={`${ariaLabel} cards, scrollable`}
        tabIndex={0}
        className="md:hidden grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto bg-secondary/50 p-3 sm:grid-cols-2 scrollbar-hide"
      >
        {hasRows && renderCard && data.map((item, index) => renderCard(item, index))}
        {showSkeleton &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border bg-card" />
          ))}
        {stateNode && <div className="col-span-full">{stateNode}</div>}
      </div>

      {/* Desktop table */}
      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden md:flex">
        <DragScrollTable className="w-full flex-1 min-h-0" ariaLabel={`${ariaLabel}, scrollable`}>
          <table
            aria-label={ariaLabel}
            className={`relative w-full border-separate border-spacing-0 ${minWidth} [&_tbody_tr:hover>td]:bg-secondary`}
          >
            <thead className="sticky top-0 z-20 bg-secondary">
              <tr>
                {headers.map((header, index) => {
                  const label = typeof header === 'object' ? header.label : header;
                  const customClass = typeof header === 'object' ? header.className || '' : '';
                  return (
                    <th
                      key={index}
                      scope="col"
                      className={`whitespace-nowrap border-b border-brand-200 bg-secondary px-3.5 py-2.5 text-left text-xs font-semibold text-brand-800 ${customClass}`}
                    >
                      {label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y bg-card">
              {hasRows && data.map((item, index) => renderRow(item, index))}
              {showSkeleton &&
                Array.from({ length: 6 }).map((_, r) => (
                  <tr key={r} className="animate-pulse">
                    {headers.map((_h, c) => (
                      <td key={c} className="px-3.5 py-3">
                        <div className="h-4 w-3/4 rounded bg-secondary" />
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
          {stateNode}
        </DragScrollTable>
      </div>

      {/* Footer */}
      {showFooter && (
      <div className="flex flex-col gap-2 rounded-b-lg border-t bg-card px-3 py-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p className="tabular-nums" aria-live="polite">
          {totalResults === 0
            ? 'No rows'
            : `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, totalResults)} of ${totalResults}`}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 whitespace-nowrap">
          <label className="flex items-center gap-2">
            Rows per page
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="h-8 w-[72px] rounded-md border border-input bg-card px-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              {itemsPerPageOptions.map((val) => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </label>
          <span className="tabular-nums">Page {Math.min(currentPage, pages)} of {pages}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-input bg-card text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= pages}
              aria-label="Next page"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-input bg-card text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default DataTable;
