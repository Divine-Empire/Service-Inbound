// Builds the calibration certificate PDF: any number of certificates, one per page, in one document.
// The preview iframe and the uploaded file come from the same function, so they can never differ.
import { drawAutoLevelPage, drawTotalStationPage } from "./auto-level-pdf.js";

export const DRAWERS = {
  auto_level: drawAutoLevelPage,
  total_station: drawTotalStationPage,
};

// certs: [{ formatId, values }] -> jsPDF document.
export async function buildCertificatesPdf(certs) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  for (const [i, cert] of certs.entries()) {
    if (i > 0) doc.addPage();
    const draw = DRAWERS[cert.formatId];
    if (!draw) throw new Error(`No certificate layout for format "${cert.formatId}"`);
    await draw(doc, cert.values, {});
  }
  return doc;
}

export async function certificatesPdfBlob(certs) {
  return (await buildCertificatesPdf(certs)).output("blob");
}
