// Escape one CSV cell. Values starting with = + - @ get a leading ' so Excel
// does not run them as a formula.
const cell = (value) => {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
};

export const buildCsv = (headers, rows) =>
  [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

// Downloads a UTF-8 CSV (with BOM so Excel reads non-ASCII text correctly).
export const exportCsv = (filename, headers, rows) => {
  const blob = new Blob(["﻿" + buildCsv(headers, rows)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
