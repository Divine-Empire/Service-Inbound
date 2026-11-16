import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, Eye, FileCheck2, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Modal } from "../../components/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useToast } from "../../hooks/use-toast";
import { supabase } from "../../lib/supabase/client";
import { CERTIFICATE_FORMATS, getCertificateFormat } from "../../lib/certificates/formats.js";
import { certificatesPdfBlob } from "../../lib/certificates/certificates-pdf.js";
import CertificateFields from "./CertificateFields";

const SERIES = [
  { id: "total_station", label: "Total Station" },
  { id: "auto_level", label: "Auto Level" },
];
const SUPPORTED = new Set(SERIES.map((s) => s.id));
const nameKey = (s) => String(s || "").trim().toLowerCase();

// "R202600451" -> { prefix: "R2026", start: 451 }
const parseNumber = (next) => (next ? { prefix: next.slice(0, -5), start: Number(next.slice(-5)) } : { prefix: `R${new Date().getFullYear()}`, start: 1 });

// One certificate per unit when `each` is on (qty 5 -> 5 certificates), otherwise one for the whole quantity.
function buildItemCerts(itemIdx, item, companyName, each, formatId) {
  const count = each ? item.qty : 1;
  const base = getCertificateFormat(formatId).getDefaults();
  return Array.from({ length: count }, (_, k) => ({
    id: `${itemIdx}-${k}-${Math.random().toString(36).slice(2, 7)}`,
    itemIdx,
    values: { ...base, customerName: companyName },
  }));
}

// Generate Certificate for one ticket: Auto Level / Total Station certificates for its machines.
// Nothing is saved or consumed here: numbers shown are only the next ones in each counter; they are
// reserved when the Calibration form is submitted. onGenerated({ groups }) hands the PDFs to the page.
export default function GenerateCertificateDialog({ ticket, onClose, onGenerated }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [peek, setPeek] = useState({ auto_level: "", total_station: "" });
  const [formats, setFormats] = useState([]);
  const [each, setEach] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const [skippedGroups, setSkippedGroups] = useState({ auto_level: false, total_station: false });
  const [certs, setCerts] = useState([]);
  const [openIds, setOpenIds] = useState(new Set());
  const [step, setStep] = useState("edit");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [busy, setBusy] = useState(false);

  const releasePreview = () =>
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const machines = (ticket.machines || []).filter((m) => m?.name);
        const names = [...new Set(machines.map((m) => m.name))];
        const [itemsRes, peekRes] = await Promise.all([
          names.length
            ? supabase.from("lto_items").select("item_name, item_code, calibration_certificate_format").in("item_name", names)
            : Promise.resolve({ data: [], error: null }),
          supabase.rpc("inbound_peek_certificate_numbers"),
        ]);
        if (itemsRes.error) throw itemsRes.error;
        if (peekRes.error) throw peekRes.error;

        // item_name / item_code are not unique in lto_items: take the first row that has a format.
        const metaByName = new Map();
        (itemsRes.data || []).forEach((r) => {
          const k = nameKey(r.item_name);
          if (r.calibration_certificate_format && !metaByName.has(k)) metaByName.set(k, r);
        });
        (itemsRes.data || []).forEach((r) => {
          const k = nameKey(r.item_name);
          if (!metaByName.has(k)) metaByName.set(k, r);
        });

        const list = machines.map((m) => {
          const meta = metaByName.get(nameKey(m.name));
          const dbFormat = meta?.calibration_certificate_format || null;
          return {
            itemName: m.name,
            itemCode: meta?.item_code || null,
            qty: Math.max(1, Number(m.qty) || 1),
            inCatalog: !!meta,
            dbFormat,
            format: SUPPORTED.has(dbFormat) ? dbFormat : null,
          };
        });
        if (cancelled) return;
        const eachArr = list.map(() => true);
        setItems(list);
        setPeek(peekRes.data || {});
        setFormats(list.map((it) => it.format));
        setEach(eachArr);
        setSkipped(list.map(() => false));
        const initial = list.flatMap((it, i) => (it.format ? buildItemCerts(i, it, ticket.companyName || "", true, it.format) : []));
        setCerts(initial);
        setOpenIds(new Set(initial.slice(0, 1).map((c) => c.id)));
      } catch (e) {
        if (!cancelled) setError(e?.message || "Could not load certificate details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticket]);

  const backToEdit = () => {
    releasePreview();
    setStep("edit");
  };

  const rebuildItem = (i, format, eachQty) => {
    setCerts((prev) => {
      const rest = prev.filter((c) => c.itemIdx !== i);
      const fresh = format ? buildItemCerts(i, items[i], ticket.companyName || "", eachQty, format) : [];
      if (fresh[0]) setOpenIds((s) => new Set(s).add(fresh[0].id));
      return [...rest, ...fresh].sort((a, b) => a.itemIdx - b.itemIdx);
    });
    backToEdit();
  };
  const setFormat = (i, format) => {
    setFormats((f) => f.map((v, k) => (k === i ? format : v)));
    setSkipped((s) => s.map((v, k) => (k === i ? false : v)));
    rebuildItem(i, format, each[i]);
  };
  const setEachQty = (i, value) => {
    setEach((e) => e.map((v, k) => (k === i ? value : v)));
    rebuildItem(i, formats[i], value);
  };
  const toggleSkip = (i) => {
    setSkipped((prev) => prev.map((s, idx) => (idx === i ? !s : s)));
    backToEdit();
  };
  const toggleSkipGroup = (id) => {
    setSkippedGroups((g) => ({ ...g, [id]: !g[id] }));
    backToEdit();
  };
  const setField = (certId, key, value) =>
    setCerts((prev) => prev.map((c) => (c.id === certId ? { ...c, values: { ...c.values, [key]: value } } : c)));
  const toggleOpen = (id) =>
    setOpenIds((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // Certificates that will be generated: not skipped (item or whole template group).
  const active = useMemo(
    () => certs.filter((c) => formats[c.itemIdx] && !skipped[c.itemIdx] && !skippedGroups[formats[c.itemIdx]]),
    [certs, formats, skipped, skippedGroups]
  );

  // Numbers continue from each counter's next value, in item order, per template.
  const numbered = useMemo(() => {
    const parsed = { auto_level: parseNumber(peek.auto_level), total_station: parseNumber(peek.total_station) };
    const used = { auto_level: 0, total_station: 0 };
    return active.map((c) => {
      const s = formats[c.itemIdx];
      const n = parsed[s].start + used[s]++;
      return { ...c, formatId: s, values: { ...c.values, certificateNo: `${parsed[s].prefix}${String(n).padStart(5, "0")}` } };
    });
  }, [active, formats, peek]);

  const firstInvalid = () => {
    for (const c of numbered) {
      const msg = getCertificateFormat(c.formatId)?.validate?.(c.values);
      if (msg) return msg;
    }
    return null;
  };

  const missing = items.map((_, i) => i).filter((i) => !formats[i] && !skipped[i]);
  const tooMany = numbered.length > 500;
  const toInput = (list) => list.map((c) => ({ formatId: c.formatId, values: c.values }));

  const handlePreview = async () => {
    const invalid = firstInvalid();
    if (invalid) return toast({ title: "Validation Error", description: invalid, variant: "destructive" });
    setBusy(true);
    try {
      const blob = await certificatesPdfBlob(toInput(numbered));
      releasePreview();
      setPreviewUrl(URL.createObjectURL(blob));
      setStep("preview");
    } catch (e) {
      toast({ title: "Error", description: e?.message || "Could not build the preview", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // One PDF per template (Total Station / Auto Level), each with only its own certificates.
  const handleGenerate = async () => {
    const invalid = firstInvalid();
    if (invalid) return toast({ title: "Validation Error", description: invalid, variant: "destructive" });
    setBusy(true);
    try {
      const groups = {};
      for (const s of SERIES) {
        const list = numbered.filter((c) => c.formatId === s.id);
        if (list.length === 0) continue;
        const blob = await certificatesPdfBlob(toInput(list));
        groups[s.id] = {
          formatId: s.id,
          certs: toInput(list),
          numbers: list.map((c) => c.values.certificateNo),
          file: new File([blob], `${s.id}_certificate_${ticket.ticketId}.pdf`, { type: "application/pdf" }),
        };
      }
      onGenerated({ groups, peeked: peek });
    } catch (e) {
      toast({ title: "Error", description: e?.message || "Could not generate the PDF", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const groupCounts = SERIES.map((s) => ({ ...s, count: numbered.filter((c) => c.formatId === s.id).length }));

  return (
    <Modal
      isOpen
      onClose={() => !busy && onClose()}
      title={`Generate Certificate - ${ticket.ticketId}`}
      size="4xl"
      bodyClassName="p-4"
    >
      <div className={`flex flex-col gap-3 ${step === "preview" ? "h-[80vh]" : "max-h-[78vh]"}`}>
        <p className="text-xs text-muted-foreground">
          {step === "edit"
            ? "One certificate per unit (or per machine). Certificate numbers are only reserved when the Calibration form is submitted."
            : "Check the certificates, then generate."}
        </p>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading machines...
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && step === "edit" && (
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {items.length === 0 && <p className="text-sm text-muted-foreground">This ticket has no machines.</p>}

            <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-3">
              {SERIES.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs">
                  <span className="font-medium">{s.label}</span>
                  <span className="font-mono text-muted-foreground">next {peek[s.id] || "-"}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={skippedGroups[s.id] ? "default" : "outline"}
                    className="h-6 px-2 text-xs"
                    onClick={() => toggleSkipGroup(s.id)}
                  >
                    {skippedGroups[s.id] ? "Skipped - undo" : "Skip all"}
                  </Button>
                </div>
              ))}
            </div>

            {items.map((item, i) => {
              const itemCerts = numbered.filter((c) => c.itemIdx === i);
              const allCerts = certs.filter((c) => c.itemIdx === i);
              const groupSkipped = formats[i] && skippedGroups[formats[i]];
              return (
                <div key={i} className={`rounded-lg border ${skipped[i] || groupSkipped ? "border-muted bg-muted/10 opacity-70" : ""}`}>
                  <div className="space-y-2 border-b bg-muted/40 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{item.itemName}</p>
                          {(skipped[i] || groupSkipped) && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">Skipped</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.itemCode || (item.inCatalog ? "No item code" : "Not in item catalog")} · Qty {item.qty}
                          {formats[i] ? ` · ${getCertificateFormat(formats[i]).name}` : ""}
                        </p>
                      </div>
                      {formats[i] && (
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          {item.qty > 1 && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Certificate for each qty</span>
                              <div className="inline-flex overflow-hidden rounded-md border">
                                {[true, false].map((v) => (
                                  <button
                                    key={String(v)}
                                    type="button"
                                    onClick={() => setEachQty(i, v)}
                                    className={`px-2.5 py-1 font-medium ${each[i] === v ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
                                  >
                                    {v ? "Yes" : "No"}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => toggleSkip(i)}>
                            {skipped[i] ? "Unskip" : "Skip"}
                          </Button>
                        </div>
                      )}
                    </div>

                    {!formats[i] && !skipped[i] && (
                      <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>
                          {item.dbFormat
                            ? `This item's format (${item.dbFormat}) is not available here.`
                            : item.inCatalog
                              ? "No certificate format is set for this item."
                              : "Custom machine (not in the item catalog)."}{" "}
                          Select a template or skip. The template's inspection list is fixed, so pick one only if it fits this instrument.
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                          <Select onValueChange={(v) => setFormat(i, v)}>
                            <SelectTrigger className="h-8 w-44 bg-white text-xs">
                              <SelectValue placeholder="Select template" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border border-slate-200 shadow-md">
                              {CERTIFICATE_FORMATS.map((f) => (
                                <SelectItem key={f.id} value={f.id} className="text-xs">
                                  {f.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="outline" size="sm" onClick={() => toggleSkip(i)} className="h-8 border-amber-300 bg-white text-xs hover:bg-amber-100">
                            Skip
                          </Button>
                        </div>
                      </div>
                    )}
                    {!formats[i] && skipped[i] && (
                      <div className="flex items-center justify-between rounded-md border border-dashed border-muted-foreground/30 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        <span className="italic">Machine skipped - no certificate will be generated.</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => toggleSkip(i)} className="h-7 text-xs text-primary hover:underline">
                          Unskip
                        </Button>
                      </div>
                    )}
                  </div>

                  {!skipped[i] && !groupSkipped &&
                    allCerts.map((c, k) => {
                      const isOpen = openIds.has(c.id);
                      const shown = itemCerts.find((n) => n.id === c.id) || c;
                      return (
                        <div key={c.id} className="border-b last:border-b-0">
                          <button type="button" onClick={() => toggleOpen(c.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent/50">
                            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <span className="font-medium">Certificate {k + 1} of {allCerts.length}</span>
                            <span className="ml-auto font-mono text-muted-foreground">{shown.values.certificateNo}</span>
                          </button>
                          {isOpen && (
                            <div className="p-3 pt-1">
                              <CertificateFields
                                format={getCertificateFormat(formats[c.itemIdx])}
                                values={c.values}
                                onChange={(key, value) => setField(c.id, key, value)}
                                idPrefix={c.id}
                                hideKeys={["certificateNo"]}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        )}

        {step === "preview" && previewUrl && <iframe title="Certificates preview" src={previewUrl} className="min-h-0 w-full flex-1 rounded border" />}

        {!loading && !error && (
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            {step === "edit" ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {groupCounts.map((g) => `${g.label}: ${g.count}`).join(" · ")}
                  {missing.length > 0 && ` · ${missing.length} machine${missing.length === 1 ? "" : "s"} need a template or skip`}
                  {tooMany && " · too many (max 500)"}
                </p>
                <Button onClick={handlePreview} disabled={busy || numbered.length === 0 || missing.length > 0 || tooMany}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                  Preview
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={backToEdit}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button onClick={handleGenerate} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
                  Generate &amp; attach
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
