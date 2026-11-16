// "Auto Level" (auto_level_template.jpeg): a full-page designed certificate drawn in code: white page
// with a crystal-pattern band at the top and bottom, Divine logo (left) and Sokkia logo (right),
// Divine watermark in the centre, boxed number / dates, Yes / No inspection table, declaration,
// date + signature footer with the machine picture, and the contact bar.
// No seal is drawn (the signature and stamp are applied by hand on the printout).
// hardcopy: only the content is drawn (no crystal bands, logos, watermark, picture or contact bar).
import { FONT, fmtDate, filled } from "./pdf-shared.js"
import { AUTO_LEVEL_CHECKS, TOTAL_STATION_CHECKS } from "./formats.js"

const BLUE = [27, 94, 150]
const EDGE = [43, 123, 185]
const INK = [20, 40, 70]

const DECLARATION =
  "WE HEREBY CERTIFY THAT THE INSTRUMENT MENTIONED MEETS THE SPECIFICATION AND THE RESULT OF THE TRACEABILITY IS CARRIED OUT IN ACCORDANCE TO OUR COMPANY'S STANDARDS."

const L = 20 // content left edge
const R = 190 // content right edge
const LABEL_COLON = 78
const VALUE_X = 84
const TOP_BAND = 58 // height of the crystal band at the top, mm
const BOTTOM_BAND = 40 // ... and at the bottom
const BAR_H = 15 // contact bar

// How strongly the crystal pattern shows: 1 = full, lower = softer and less sharp (the blues keep their colour).
const CRYSTAL_INTENSITY = 0.5
const WATERMARK_OPACITY = 0.07 * 1.25 * 2

// Crystal pattern: a jittered triangle mesh in blues, solid at the page edge and fading to white
// towards the page centre. Seeded, so every certificate gets the same pattern.
function rng(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function drawCrystalBand(doc, W, y0, y1, edgeAtTop, seed) {
  const rand = rng(seed)
  const cols = 13
  const rows = 5
  const cw = W / cols
  const bandH = y1 - y0
  const rh = bandH / rows
  const pts = []
  for (let r = 0; r <= rows; r++) {
    pts[r] = []
    for (let c = 0; c <= cols; c++) {
      const edge = r === 0 || r === rows || c === 0 || c === cols
      const jx = edge && (c === 0 || c === cols) ? 0 : (rand() - 0.5) * cw * 0.7
      const jy = edge && (r === 0 || r === rows) ? 0 : (rand() - 0.5) * rh * 0.7
      pts[r][c] = [c * cw + jx, y0 + r * rh + jy]
    }
  }
  const SHADES = [[40, 130, 200], [70, 160, 220], [105, 185, 235], [150, 208, 242], [24, 100, 170]]
  const levels = new Map()
  const gs = (a) => {
    const q = Math.round(a * 12) / 12
    if (!levels.has(q)) levels.set(q, new doc.GState({ opacity: q, "stroke-opacity": q * 0.5 }))
    return levels.get(q)
  }
  doc.setLineWidth(0.15)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = pts[r][c], b = pts[r][c + 1], d = pts[r + 1][c], e = pts[r + 1][c + 1]
      const tris = rand() > 0.5 ? [[a, b, d], [b, e, d]] : [[a, b, e], [a, e, d]]
      for (const t of tris) {
        const cy = (t[0][1] + t[1][1] + t[2][1]) / 3
        const depth = (cy - y0) / bandH // 0 at the band's top, 1 at its bottom
        const nearEdge = edgeAtTop ? 1 - depth : depth // 1 at the page edge, 0 at the inner end
        const opacity = Math.max(0, Math.min(1, nearEdge * 1.15 - 0.12 + (rand() - 0.5) * 0.18)) * CRYSTAL_INTENSITY
        if (opacity < 0.04) continue
        doc.setGState(gs(opacity))
        doc.setFillColor(...SHADES[Math.floor(rand() * SHADES.length)])
        doc.setDrawColor(255, 255, 255)
        doc.triangle(t[0][0], t[0][1], t[1][0], t[1][1], t[2][0], t[2][1], "FD")
      }
    }
  }
  doc.setGState(new doc.GState({ opacity: 1, "stroke-opacity": 1 }))
}

// An SVG from /public drawn to a PNG (transparent background) once per session.
const svgCache = new Map()
function loadSvg(src, widthPx, dropFill) {
  if (!svgCache.has(src)) {
    svgCache.set(
      src,
      (async () => {
        let url = src
        try {
          // dropFill: the Divine logo file carries a near-white background shape; take it out so the
          // logo sits cleanly on the crystal band and as a watermark.
          if (dropFill) {
            const text = await (await fetch(src)).text()
            const clean = text.replace(new RegExp(`<path[^>]*fill="${dropFill}"[^>]*/>`, "g"), "")
            url = URL.createObjectURL(new Blob([clean], { type: "image/svg+xml" }))
          }
          const img = new Image()
          img.src = url
          await img.decode()
          const h = Math.round((widthPx * img.naturalHeight) / img.naturalWidth)
          const canvas = document.createElement("canvas")
          canvas.width = widthPx
          canvas.height = h
          canvas.getContext("2d").drawImage(img, 0, 0, widthPx, h)
          return { dataUrl: canvas.toDataURL("image/png"), ratio: widthPx / h }
        } catch {
          return null // a missing image must not block the certificate
        } finally {
          if (url !== src) URL.revokeObjectURL(url)
        }
      })()
    )
  }
  return svgCache.get(src)
}

function drawImageFit(doc, img, alias, x, y, w) {
  if (img) doc.addImage(img.dataUrl, "PNG", x, y, w, w / img.ratio, alias, "FAST")
}

function drawTitle(doc, W) {
  doc.setTextColor(0, 0, 0)
  doc.setFont(FONT, "bold")
  doc.setFontSize(27)
  doc.text("CALIBRATION CERTIFICATE", W / 2, 44, { align: "center" })
  doc.setFontSize(9.5)
  doc.setTextColor(...INK)
  doc.text("AN ISO 9001:2015 CERTIFIED ORGANIZATION", W / 2, 50, { align: "center" })
}

// One bordered cell per character (certificate number, dates).
function drawCells(doc, x, y, chars, { w = 6, h = 6.4, gapAfter = [] } = {}) {
  doc.setDrawColor(...EDGE)
  doc.setLineWidth(0.4)
  chars.forEach((ch, i) => {
    doc.setFillColor(255, 255, 255) // drawing text changes the fill colour, so set it for every cell
    doc.rect(x, y - h + 1.6, w, h, "FD")
    doc.setTextColor(...INK)
    doc.setFont(FONT, "bold")
    doc.setFontSize(12)
    doc.text(ch, x + w / 2, y, { align: "center" })
    x += w + (gapAfter.includes(i) ? 2.2 : 0)
  })
}

// Empty DD MM YYYY boxes: the dates are written by hand on the printout.
function drawDateCells(doc, x, y) {
  drawCells(doc, x, y, Array(8).fill(""), { gapAfter: [1, 3] })
}

function drawDetails(doc, v) {
  let y = 66
  const label = (text) => {
    doc.setFont(FONT, "bold")
    doc.setFontSize(9.5)
    doc.setTextColor(...INK)
    doc.text(text, L, y)
    doc.text(":", LABEL_COLON, y)
  }
  const textRow = (text, value) => {
    label(text)
    doc.setFont(FONT, "bold")
    doc.setFontSize(11.5)
    doc.setTextColor(...INK)
    const lines = doc.splitTextToSize(String(value ?? "").trim() || " ", R - VALUE_X).slice(0, 2)
    doc.text(lines, VALUE_X, y)
    doc.setDrawColor(...EDGE)
    doc.setLineWidth(0.25)
    doc.setLineDashPattern([0.6, 0.7], 0)
    lines.forEach((_, i) => doc.line(VALUE_X, y + 1.3 + i * 5, R, y + 1.3 + i * 5))
    doc.setLineDashPattern([], 0)
    y += 8 + (lines.length - 1) * 5
  }

  label("CERTIFICATE NUMBER")
  drawCells(doc, VALUE_X, y, String(v.certificateNo ?? "").replace(/\s+/g, "").split("").slice(0, 14))
  y += 8.4
  textRow("COMPANY NAME", v.customerName)
  textRow("INSTRUMENT TYPE", v.instrumentName)
  textRow("MANUFACTURE", v.manufacture)
  textRow("MODEL", v.model)
  textRow("SERIAL NO.", v.serialNo)
  label("CALIBRATION DATE")
  drawDateCells(doc, VALUE_X, y)
  y += 8.4
  label("CALIBRATION DUE DATE")
  drawDateCells(doc, VALUE_X, y)
  return y + 6
}

function drawTick(doc, x, y, size) {
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.6)
  doc.line(x + size * 0.2, y + size * 0.55, x + size * 0.42, y + size * 0.8)
  doc.line(x + size * 0.42, y + size * 0.8, x + size * 0.82, y + size * 0.18)
}

// Table cells are outlined only (no white fill), so the watermark shows through.
function drawTable(doc, startY, v, checks) {
  const colSno = 14
  const colAccept = 52
  const x0 = L
  const x1 = x0 + colSno
  const x2 = R - colAccept
  const headH = 9
  // A longer inspection list (Total Station, 11 points) uses tighter rows so the page still fits.
  const long = checks.length > 8
  const rowH = long ? 7 : 9
  const rowGap = long ? 1.1 : 1.6
  let y = startY

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.7)
  ;[
    [x0, colSno, "S No."],
    [x1, x2 - x1, "Inspection"],
    [x2, colAccept, "Acceptance"],
  ].forEach(([x, w, t]) => {
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.7)
    doc.rect(x, y, w, headH, "S")
    doc.setTextColor(...BLUE)
    doc.setFont(FONT, "bold")
    doc.setFontSize(12.5)
    doc.text(t, x + w / 2, y + headH / 2 + 1.6, { align: "center" })
  })
  y += headH + 1.6

  checks.forEach((item, i) => {
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.7)
    doc.rect(x0, y, colSno, rowH, "S")
    doc.rect(x1, y, x2 - x1, rowH, "S")
    doc.rect(x2, y, colAccept, rowH, "S")
    doc.setFont(FONT, "bold") // inspection text (number and label) in bold
    doc.setFontSize(12.5) // inspection points
    doc.setTextColor(...BLUE)
    doc.text(`${i + 1}.`, x0 + colSno / 2, y + rowH / 2 + 1.4, { align: "center" })
    doc.text(item.label, x1 + 3, y + rowH / 2 + 1.4)

    // "Yes [box]  No [box]"; the chosen answer's box carries the tick.
    const box = 5.2
    const by = y + (rowH - box) / 2
    doc.setFont(FONT, "bold")
    const yesX = x2 + 3
    const noX = x2 + 28
    doc.text("Yes", yesX, y + rowH / 2 + 1.4)
    doc.text("No", noX, y + rowH / 2 + 1.4)
    const yesBox = yesX + doc.getTextWidth("Yes") + 2
    const noBox = noX + doc.getTextWidth("No") + 2
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.rect(yesBox, by, box, box, "S")
    doc.rect(noBox, by, box, box, "S")
    if (v[item.key] === "yes") drawTick(doc, yesBox, by, box)
    if (v[item.key] === "no") drawTick(doc, noBox, by, box)
    y += rowH + rowGap
  })
  return y
}

function drawFooter(doc, W, H, v, images, hardcopy, machine) {
  // Date (defaults to today in the form) and the blank signature, each over a horizontal line.
  const dateY = 262
  const parts = fmtDate(v.certDate).split("-")
  const dateText = parts.length === 3 ? `${parts[0]} | ${parts[1]} | ${parts[2]}` : ""
  doc.setFont(FONT, "bold")
  doc.setTextColor(...INK)
  doc.setFontSize(13)
  doc.text(dateText, L + 18, dateY, { align: "center" })
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.4)
  doc.line(L, dateY + 1.6, L + 36, dateY + 1.6)
  doc.line(R - 36, dateY + 1.6, R, dateY + 1.6)
  doc.setFontSize(10.5)
  doc.text("DATE", L + 18, dateY + 7, { align: "center" })
  doc.text("SIGNATURE", R - 18, dateY + 7, { align: "center" })

  if (hardcopy) return

  // The machine picture, centred between Date and Signature.
  if (images.machine) {
    const w = machine.width // sits between the declaration and the contact bar
    drawImageFit(doc, images.machine, `dimachine${machine.src}`, W / 2 - w / 2, H - BAR_H - 2 - w / images.machine.ratio, w)
  }

  doc.setFillColor(...BLUE)
  doc.rect(0, H - BAR_H, W, BAR_H, "F")
  const items = [
    ["www.thedivineempire.com", "left"],
    ["315, 3rd Floor, Lalganga Midas, Fafadih, Raipur. (492001)", "center"],
    ["service@thedivineempire.com", "right"],
  ]
  // As large as fits on one line with room between the three pieces.
  let size = 10.5
  doc.setFont(FONT, "bold")
  for (; size > 7; size -= 0.25) {
    doc.setFontSize(size)
    const total = items.reduce((sum, [t]) => sum + doc.getTextWidth(t), 0)
    if (total + 2 * 8 <= W - 2 * 10) break
  }
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(size)
  const ty = H - BAR_H / 2 + size * 0.17
  doc.text(items[0][0], 10, ty)
  doc.text(items[1][0], W / 2, ty, { align: "center" })
  doc.text(items[2][0], W - 10, ty, { align: "right" })
}

// The picture in the footer is the only thing that differs between the instruments.
const AUTO_LEVEL_MACHINE = { src: "/cert/machine_auto_level.svg", width: 34, checks: AUTO_LEVEL_CHECKS }
const TOTAL_STATION_MACHINE = { src: "/cert/total_station.png", width: 30, checks: TOTAL_STATION_CHECKS }

export const drawAutoLevelPage = (doc, values, assets) => drawInstrumentPage(doc, values, assets, AUTO_LEVEL_MACHINE)
export const drawTotalStationPage = (doc, values, assets) => drawInstrumentPage(doc, values, assets, TOTAL_STATION_MACHINE)

async function drawInstrumentPage(doc, values, assets, machine) {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const hardcopy = !!assets?.hardcopy
  const images = hardcopy
    ? {}
    : {
        // the icon alone, for the watermark
        divine: await loadSvg("/cert/divine-logo.svg", 600, "rgb\\(246,246,246\\)"),
        // logo with the company name (white background removed), for the header
        brand: await loadSvg("/cert/logo_with_name.png", 1400),
        // white letters on teal, as supplied (cropped to the artwork)
        sokkia: await loadSvg("/cert/sokkia_logo.png", 800),
        machine: await loadSvg(machine.src, 600),
      }

  if (!hardcopy) {
    drawCrystalBand(doc, W, 0, TOP_BAND, true, 11)
    drawCrystalBand(doc, W, H - BOTTOM_BAND, H, false, 29)
    // Divine logo as a faint watermark in the middle of the page.
    if (images.divine) {
      try {
        doc.setGState(new doc.GState({ opacity: WATERMARK_OPACITY }))
        const w = 115
        drawImageFit(doc, images.divine, "diwatermark", W / 2 - w / 2, H / 2 - w / images.divine.ratio / 2, w)
      } finally {
        doc.setGState(new doc.GState({ opacity: 1 }))
      }
    }
    // Header: company logo with name (left) and Sokkia (right), straight on the crystal band, no box.
    if (images.brand) drawImageFit(doc, images.brand, "dibrand", 13, 12, 66)
    if (images.sokkia) drawImageFit(doc, images.sokkia, "disokkia", W - 13 - 48, 12.5, 48)
  }

  drawTitle(doc, W)
  let y = drawDetails(doc, values)
  y = drawTable(doc, y + 4, values, machine.checks)

  doc.setFont(FONT, "bold")
  doc.setFontSize(12.5)
  doc.setTextColor(...INK)
  const lines = doc.splitTextToSize(DECLARATION, 160)
  y += 7
  doc.text(lines, W / 2, y, { align: "center", lineHeightFactor: 1.25 })
  y += lines.length * 5.8

  drawFooter(doc, W, H, values, images, hardcopy, machine)
  return y
}
