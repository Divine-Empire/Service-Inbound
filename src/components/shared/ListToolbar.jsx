import StatusTabs from "./StatusTabs";
import { FilterSearch, FilterChips, filterControlClass } from "./FilterBar";
import { ColumnSelector } from "./ColumnSelector";
import FilterDialog, { FilterSection } from "./FilterDialog";
import { MultiSelect } from "../ui/multi-select";
import { isFilterActive } from "../../hooks/useClientList";

/**
 * The toolbar every list page shares: tabs, search, the page's filters, the column picker,
 * page-specific `actions` (Export CSV, New Enquiry ...) and the active-filter chips.
 * Works with the object returned by useClientList or useStageList.
 *
 * `filtersInDialog` moves the filter selects into one Filters button + dialog (with an active count).
 * `extraFilters` renders page-specific controls (date chips, a multi-select ...) between
 * the filter selects and the column picker.
 */
export default function ListToolbar({ list, searchPlaceholder = "Search...", actions, extraFilters, showColumns = true, filtersInDialog = false }) {
  const specs = list.filterSpec || [];
  const activeCount = specs.filter((f) => isFilterActive(f, list.filterValues[f.key])).length;
  const selectFor = (f, full) => f.multi ? (
    <MultiSelect
      key={f.key}
      options={list.filterOptions[f.key] || []}
      value={list.filterValues[f.key] || []}
      onChange={(v) => list.setFilter(f.key, v)}
      placeholder={f.allLabel || `All ${f.label}`}
      className={full ? "w-full" : "w-[200px]"}
    />
  ) : (
    <select
      key={f.key}
      aria-label={f.label}
      value={list.filterValues[f.key]}
      onChange={(e) => list.setFilter(f.key, e.target.value)}
      className={`${filterControlClass} ${full ? "w-full" : "w-auto max-w-[220px]"}`}
    >
      <option value="all">{f.allLabel || `All ${f.label}`}</option>
      {(list.filterOptions[f.key] || []).map((v) => (
        <option key={v} value={v}>{v}</option>
      ))}
    </select>
  );
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <StatusTabs tabs={list.tabs} activeTab={list.tab} onChange={list.setTab} />
        <FilterSearch value={list.search} onChange={list.setSearch} placeholder={searchPlaceholder} className="min-w-[220px]" />
        {filtersInDialog ? (
          specs.length > 0 && (
            <FilterDialog activeCount={activeCount} onClear={list.clearAll}>
              {specs.map((f) => (
                <FilterSection key={f.key} title={f.label}>{selectFor(f, true)}</FilterSection>
              ))}
            </FilterDialog>
          )
        ) : (
          specs.map((f) => selectFor(f, false))
        )}
        {extraFilters}
        {showColumns && list.columnPanel.columns.some((c) => !c.fixed) && <ColumnSelector {...list.columnPanel} />}
        {actions}
      </div>
      <FilterChips chips={list.chips} onClearAll={list.clearAll} />
    </div>
  );
}
