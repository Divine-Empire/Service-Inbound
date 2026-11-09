import DataTable from "./DataTable";
import { PAGE_SIZES } from "../../hooks/useStageList";

// Value shown for a column: `cell(row, ctx)` if it has one, else `text(row)`, else "-".
export const renderValue = (col, row, ctx) => {
  const v = col.cell ? col.cell(row, ctx) : col.text ? col.text(row) : row[col.key];
  return v === "" || v === null || v === undefined ? <span className="text-muted-foreground">-</span> : v;
};

// Wrapped cell: at most 2 lines at the column width, full text on hover (native tooltip).
function WrapCell({ col, row, ctx }) {
  const raw = col.text ? col.text(row) : col.cell ? null : row[col.key];
  const full = typeof raw === "string" ? raw : undefined;
  return (
    <div className="line-clamp-2 break-words" title={full}>
      {renderValue(col, row, ctx)}
    </div>
  );
}

/**
 * DataTable driven by a list hook + column definitions: one definition renders the desktop
 * table row AND the mobile card, so the two can no longer drift apart.
 *
 *   rowKey(row, tab)   stable key (never the array index)
 *   emptyTitle         string, or { pending: "...", history: "..." } per tab
 *   cardTitle(row)     optional heading for the mobile card (default: first non-fixed column)
 *   ctx                extra object handed to every column's cell(row, ctx) next to { tab },
 *                      e.g. { onProcess } so an Action column can call the page's handlers
 */
export default function ListTable({ list, rowKey, emptyTitle = "No records found", emptyDescription, cardTitle, ariaLabel = "Records", minWidth, heightClass, ctx: extraCtx }) {
  const ctx = { tab: list.tab, ...extraCtx };
  const cols = list.activeColumns;
  const fixedCols = cols.filter((c) => c.fixed);
  const dataCols = cols.filter((c) => !c.fixed);
  const title = typeof emptyTitle === "object" ? emptyTitle[list.tab] || "No records found" : emptyTitle;

  const headers = cols.map((c) => ({ label: c.label, className: c.headerClassName }));

  return (
    <DataTable
      headers={headers}
      data={list.rows}
      loading={list.loading}
      error={list.error}
      onRetry={list.retry}
      renderRow={(row) => (
        <tr key={rowKey(row, list.tab)} className="transition-colors">
          {cols.map((c) => (
            <td
              key={c.key}
              className={`px-3.5 py-2.5 align-top text-sm text-foreground ${c.strong ? "font-semibold" : ""} ${c.wrap ? "whitespace-normal" : "whitespace-nowrap"} ${c.cellClassName || ""}`}
              style={c.width ? (c.wrap ? { minWidth: c.width, maxWidth: c.width } : { minWidth: c.width }) : undefined}
            >
              {c.wrap ? <WrapCell col={c} row={row} ctx={ctx} /> : renderValue(c, row, ctx)}
            </td>
          ))}
        </tr>
      )}
      renderCard={(row) => (
        <div key={rowKey(row, list.tab)} className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 break-words text-sm font-semibold text-foreground">
              {cardTitle ? cardTitle(row) : dataCols[0] ? renderValue(dataCols[0], row, ctx) : null}
            </p>
            {fixedCols.length > 0 && <div className="flex flex-shrink-0 flex-wrap gap-1.5">{fixedCols.map((c) => <span key={c.key}>{renderValue(c, row, ctx)}</span>)}</div>}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            {(cardTitle ? dataCols : dataCols.slice(1)).map((c) => (
              <div key={c.key} className="min-w-0">
                <dt className="text-muted-foreground">{c.label}</dt>
                <dd className="break-words text-foreground">{renderValue(c, row, ctx)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      currentPage={list.page}
      totalPages={list.totalPages}
      itemsPerPage={list.pageSize}
      totalResults={list.total}
      onPageChange={list.setPage}
      onItemsPerPageChange={list.setPageSize}
      itemsPerPageOptions={PAGE_SIZES}
      emptyTitle={title}
      emptyDescription={emptyDescription}
      ariaLabel={ariaLabel}
      minWidth={minWidth}
      heightClass={heightClass}
    />
  );
}
