import { useEffect, useMemo, useState } from "react";
import { Loader2, Download } from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { supabase } from "../../lib/supabase/client";
import { CATS, defaultRange, fetchWeeklyReport, ymd } from "../../lib/supabase/reportQueries";

const fmtDate = (raw) => {
  if (!raw) return "-";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
const inr = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

async function exportSheet(filename, headers, rows) {
  if (rows.length === 0) {
    toast.error("No records to export");
    return;
  }
  const XLSX = await import("xlsx");
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = headers.map((h, i) => ({
    wch: Math.min(40, Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? "").length)) + 2),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}_${ymd(new Date())}.xlsx`);
}

function DateRange({ range, setRange, onReset }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col">
        <span className="text-[10px] text-gray-500">From</span>
        <Input
          type="date"
          className="h-10 w-[150px] bg-card border-input"
          value={range.from}
          max={range.to || undefined}
          onChange={(e) => setRange({ ...range, from: e.target.value })}
        />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] text-gray-500">To</span>
        <Input
          type="date"
          className="h-10 w-[150px] bg-card border-input"
          value={range.to}
          min={range.from || undefined}
          onChange={(e) => setRange({ ...range, to: e.target.value })}
        />
      </div>
      <Button variant="outline" className="h-10" onClick={onReset}>
        Reset
      </Button>
    </div>
  );
}

const Loading = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

// ───────────────────────── Weekly ─────────────────────────

function WeeklyTab({ range, reloadKey }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!range.from || !range.to) return;
    let cancelled = false;
    setLoading(true);
    fetchWeeklyReport(supabase, range)
      .then((d) => !cancelled && setData(d))
      .catch((e) => {
        console.error(e);
        toast.error("Failed to load weekly report");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, reloadKey]);

  const rows = useMemo(() => {
    if (!data) return [];
    const r = data.result;
    const conv = (c) => {
      const p = r[c].tillDatePending;
      return p === 0 ? "-" : `${((r[c].totalBilling / p) * 100).toFixed(1)}%`;
    };
    return [
      { label: "OUTGOING ENQUIRIES", get: (c) => r[c].outgoingEnq },
      { label: "↳ Total Value", sub: true, get: (c) => inr(r[c].outgoingValue) },
      { label: "INCOMING ENQUIRIES", get: (c) => r[c].incomingEnq },
      { label: "↳ Total Value", sub: true, get: (c) => inr(r[c].incomingValue) },
      { label: "TILL DATE PENDING ENQ", note: "(last 60 days)", get: (c) => r[c].tillDatePending },
      { label: "↳ Total Value", sub: true, get: (c) => inr(r[c].tillDatePendingValue) },
      { label: "TOTAL NO. BILLING", get: (c) => r[c].totalBilling },
      { label: "CONVERSION %", get: conv },
      { label: "INVOICE VALUE", get: (c) => inr(r[c].invoiceValue) },
      {
        label: "AVG TCK SIZE",
        get: (c) => (r[c].totalBilling === 0 ? "-" : inr(r[c].invoiceValue / r[c].totalBilling)),
      },
    ];
  }, [data]);

  const columns = [...CATS, "TOTAL"];

  const handleExport = () =>
    exportSheet(
      "Weekly_Report",
      ["Metric", ...columns],
      rows.map((row) => [row.label.replace("↳ ", ""), ...columns.map((c) => row.get(c))])
    );

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2">
        <p className="text-xs text-gray-400">
          {data ? `${fmtDate(data.start)} – ${fmtDate(data.end)}` : ""} · TILL DATE PENDING ENQ always
          reflects the last 60 days · a ticket with several enquiry types is counted in each of its columns (TOTAL counts it once)
        </p>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={!data}>
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
      </div>
      {loading || !data ? (
        <Loading />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary hover:bg-secondary">
              <TableHead className="w-[210px] py-3 text-xs font-bold text-brand-800">CATEGORY</TableHead>
              {columns.map((c) => (
                <TableHead key={c} className="py-3 text-center text-xs font-bold text-brand-800">
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow
                key={i}
                className={row.sub ? "bg-gray-50/20 border-l-2 border-l-blue-400/50" : i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}
              >
                <TableCell className={`py-2.5 text-xs ${row.sub ? "pl-6 font-medium text-gray-500" : "font-semibold text-gray-700"}`}>
                  {row.label}
                  {row.note && <span className="ml-1 text-[10px] font-normal text-gray-400">{row.note}</span>}
                </TableCell>
                {columns.map((c) => (
                  <TableCell
                    key={c}
                    className={`py-2.5 text-center text-xs ${c === "TOTAL" ? "font-bold" : "font-medium"} text-gray-600`}
                  >
                    {row.get(c)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

export default function Report() {
  const [range, setRange] = useState(() => defaultRange(7));
  const [reloadKey] = useState(0);

  return (
    <div className="space-y-2">
      <Card>
        <CardHeader className="flex flex-col items-start justify-between gap-3 border-b px-4 py-3 md:flex-row md:items-center">
          <h2 className="text-sm font-semibold text-brand-800">Weekly Report</h2>
          <DateRange range={range} setRange={setRange} onReset={() => setRange(defaultRange(7))} />
        </CardHeader>
        <CardContent className="p-0 pt-2">
          <WeeklyTab range={range} reloadKey={reloadKey} />
        </CardContent>
      </Card>
    </div>
  );
}
