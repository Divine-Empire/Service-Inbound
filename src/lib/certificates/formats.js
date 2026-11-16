// Calibration certificate templates available in Service-Inbound: Auto Level and Total Station.
// An id here is the value stored in lto_items.calibration_certificate_format and the key of its PDF
// drawer in certificates-pdf.js. Labels never change, only the values are edited.
// Each template has its own certificate-number series (R<year><5-digit>, see migration 0083).

const YEAR = () => new Date().getFullYear();

const checklistItems = (labels) => labels.map((label, i) => ({ key: `chk${i + 1}`, label }));

export const AUTO_LEVEL_CHECKS = checklistItems([
  "Rotating Parts Function Check",
  "Circular Level Check & Adjustment",
  "Leveling Screw Motion Check",
  "Fine Motion Rotation Check",
  "Pinion Rotation Check",
  "Fixing Of Base Plate & Cover Plate",
  "Collimation Check",
  "Compensator Check",
]);

export const TOTAL_STATION_CHECKS = checklistItems([
  "Rotating Parts Function Check",
  "Key Function Check",
  "H & V Encoder Check",
  "Circular Level Check & Adjustment",
  "Plate Level Check & Adjustment",
  "Accuracy Of Tilt Center",
  "Collimation Check",
  "Horizontal Angle Check",
  "Vertical Angle Check",
  "EDM Unit",
  "Optical Plummet Check & Adjustment.",
]);

// Today as yyyy-mm-dd in local time (the footer Date defaults to it).
export function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function createInstrumentFormat({ id, name, instrumentName, checks }) {
  return {
    id,
    name,
    fields: [
      { key: "customerName", label: "Company Name" },
      { key: "certificateNo", label: "Certificate Number" },
      { key: "instrumentName", label: "Instrument Type" },
      { key: "manufacture", label: "Manufacture" },
      { key: "model", label: "Model" },
      { key: "serialNo", label: "Serial No." },
      // Calibration Date / Due Date are not form fields: the certificate prints empty boxes for them,
      // to be filled in by pen after printing.
      { key: "certDate", label: "Date (footer)", type: "date" },
    ],
    checklist: { title: "Inspection", items: checks },
    validate: (v) => {
      const open = checks.findIndex((c) => v[c.key] !== "yes" && v[c.key] !== "no");
      return open >= 0 ? `${name} certificate: select Yes or No for "${checks[open].label}" (and every other inspection row)` : null;
    },
    getDefaults: () => ({
      customerName: "",
      certificateNo: `R${YEAR()}`, // replaced by the dialog with the next number
      instrumentName,
      manufacture: "SOKKIA",
      model: "",
      serialNo: "",
      certDate: todayIso(),
      ...Object.fromEntries(checks.map((c) => [c.key, ""])),
    }),
  };
}

export const AUTO_LEVEL_FORMAT = createInstrumentFormat({
  id: "auto_level",
  name: "Auto Level",
  instrumentName: "AUTOMATIC LEVEL",
  checks: AUTO_LEVEL_CHECKS,
});
export const TOTAL_STATION_FORMAT = createInstrumentFormat({
  id: "total_station",
  name: "Total Station",
  instrumentName: "TOTAL STATION",
  checks: TOTAL_STATION_CHECKS,
});

export const CERTIFICATE_FORMATS = [AUTO_LEVEL_FORMAT, TOTAL_STATION_FORMAT];
export const getCertificateFormat = (id) => CERTIFICATE_FORMATS.find((f) => f.id === id) ?? null;
