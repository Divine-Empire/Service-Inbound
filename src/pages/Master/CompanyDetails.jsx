import { useEffect, useRef, useState } from "react";
import { DataTable, FilterSearch } from "../../components/shared";
import { useDebounced } from "../../hooks/useDebounced";
import { ltoSupabase } from "../../lib/supabase/ltoClient";

const PAGE_SIZE = 20;
const CHUNK_PAGES = 5; // 5 pages x 20 rows = 100 rows per request
const CHUNK_SIZE = PAGE_SIZE * CHUNK_PAGES;

const DASH = <span className="text-muted-foreground">-</span>;

// A search term is matched literally: % and _ are LIKE wildcards, `,()` would break or=(...).
const likeTerm = (s) => s.replace(/[\\%_]/g, (m) => `\\${m}`).replace(/[,()"]/g, " ");

// Read-only client master from Lead-To-Order (lto_client_master). Rows are fetched lazily in
// chunks of 100 (five 20-row pages): the first chunk loads on open, the next one only when
// the user pages past it, so the table is never capped at 1000 rows and never loaded whole.
export default function CompanyDetails() {
  const [search, setSearch] = useState("");
  const term = useDebounced(search.trim(), 350);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [chunks, setChunks] = useState({}); // chunk index -> rows
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requested = useRef(new Set());
  const generation = useRef(0); // bumps on every new search; late replies of an old one are dropped

  // New search: forget everything and start again from page 1.
  useEffect(() => {
    generation.current += 1;
    requested.current = new Set();
    setChunks({});
    setTotal(0);
    setPage(1);
    setError(null);
    setLoading(true);
  }, [term]);

  const chunk = Math.floor((page - 1) / CHUNK_PAGES);

  const loadChunk = async (index, gen) => {
    requested.current.add(index);
    setLoading(true);
    try {
      let q = ltoSupabase
        .from("lto_client_master")
        .select("company_name, state, state_code, gst_number, billing_address, company_group_name", { count: "exact" })
        .order("company_name", { ascending: true })
        .order("gst_number", { ascending: true });
      if (term) {
        const like = `%${likeTerm(term)}%`;
        q = q.or(`company_name.ilike."${like}",gst_number.ilike."${like}"`);
      }
      const from = index * CHUNK_SIZE;
      const { data, error: err, count } = await q.range(from, from + CHUNK_SIZE - 1);
      if (err) throw err;
      if (gen !== generation.current) return;
      setChunks((prev) => ({ ...prev, [index]: data || [] }));
      setTotal(count ?? 0);
    } catch (e) {
      if (gen !== generation.current) return;
      console.error("Error fetching company details:", e);
      requested.current.delete(index);
      setError("Failed to load company details.");
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (requested.current.has(chunk)) return;
    loadChunk(chunk, generation.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunk, term]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const offset = ((page - 1) % CHUNK_PAGES) * PAGE_SIZE;
  const rows = (chunks[chunk] || []).slice(offset, offset + PAGE_SIZE);

  const retry = () => {
    setError(null);
    loadChunk(chunk, generation.current);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSearch value={search} onChange={setSearch} placeholder="Search by company name or GST number..." className="min-w-[220px]" />
      </div>
      <DataTable
        headers={["Company Name", "State", "State Code", "GST Number", "Billing Address", "Company Group Name"]}
        data={rows}
        loading={loading}
        error={error}
        onRetry={retry}
        minWidth="min-w-[1100px]"
        ariaLabel="Companies"
        emptyTitle="No companies found."
        currentPage={page}
        totalPages={totalPages}
        itemsPerPage={PAGE_SIZE}
        totalResults={total}
        onPageChange={(p) => setPage(Math.min(Math.max(1, p), totalPages))}
        onItemsPerPageChange={() => {}}
        itemsPerPageOptions={[PAGE_SIZE]}
        renderRow={(c, i) => (
          <tr key={`${chunk}-${offset + i}`} className="transition-colors">
            <td className="px-3.5 py-2.5 align-top text-sm font-semibold text-foreground">{c.company_name || DASH}</td>
            <td className="whitespace-nowrap px-3.5 py-2.5 align-top text-sm text-foreground">{c.state || DASH}</td>
            <td className="whitespace-nowrap px-3.5 py-2.5 align-top text-sm text-foreground">{c.state_code || DASH}</td>
            <td className="whitespace-nowrap px-3.5 py-2.5 align-top text-sm text-foreground">{c.gst_number || DASH}</td>
            <td className="min-w-[240px] max-w-[320px] px-3.5 py-2.5 align-top text-sm text-foreground">
              <div className="line-clamp-2 break-words" title={c.billing_address || ""}>{c.billing_address || DASH}</div>
            </td>
            <td className="px-3.5 py-2.5 align-top text-sm text-foreground">{c.company_group_name || DASH}</td>
          </tr>
        )}
        renderCard={(c, i) => (
          <div key={`${chunk}-${offset + i}`} className="rounded-lg border bg-card p-3 shadow-sm">
            <p className="break-words text-sm font-semibold text-foreground">{c.company_name || DASH}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              {[
                ["State", c.state],
                ["State Code", c.state_code],
                ["GST Number", c.gst_number],
                ["Group", c.company_group_name],
              ].map(([label, v]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-words text-foreground">{v || DASH}</dd>
                </div>
              ))}
              <div className="col-span-2 min-w-0">
                <dt className="text-muted-foreground">Billing Address</dt>
                <dd className="break-words text-foreground">{c.billing_address || DASH}</dd>
              </div>
            </dl>
          </div>
        )}
      />
    </div>
  );
}
