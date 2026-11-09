"use client"

import { supabase } from "../../lib/supabase/client"

// NOTE: This file used to also export a full second copy of the Make
// Quotation page (a default-exported `Quotation` component) plus a
// getCompanyPrefix() helper — both built on the old Apps Script backend
// (VITE_APPS_SCRIPT_API) and never imported anywhere in the app (the real
// page is src/pages/Quotation/MakeQuotation.jsx). Removed as dead code —
// only getNextQuotationNumber below is actually used, by MakeQuotation.jsx,
// quotation-form.jsx and consignee-details.jsx.

const currentFinancialYear = () => {
  const now = new Date()
  const currentYear = now.getFullYear()
  const financialYearStart = now.getMonth() >= 3 ? currentYear : currentYear - 1
  const financialYearEnd = financialYearStart + 1
  const startShort = String(financialYearStart).slice(-2)
  const endShort = String(financialYearEnd).slice(-2)
  return startShort + "-" + endShort
}

export const getNextQuotationNumber = async (companyPrefix = "IN") => {
  const currentFY = currentFinancialYear()
  const prefix = `${companyPrefix}-${currentFY}-`

  try {
    const { data, error } = await supabase
      .from("inbound_make_quotations")
      .select("quotation_no")
      .like("quotation_no", `${prefix}%`)

    if (error) throw error

    // Only consider base numbers (no "-01"/"-02" revision suffix) when
    // finding the highest sequence used so far for this prefix+year.
    const sequenceNumbers = (data || [])
      .map((row) => row.quotation_no.slice(prefix.length))
      .filter((rest) => /^\d+$/.test(rest))
      .map((rest) => Number.parseInt(rest, 10))

    if (sequenceNumbers.length === 0) {
      return `${prefix}1001`
    }

    const nextSequence = Math.max(...sequenceNumbers) + 1
    return `${prefix}${nextSequence}`
  } catch (error) {
    console.error("Error getting next quotation number:", error)
    return `${prefix}1001`
  }
}
