/**
 * Centralized "planned_at" calculation rules, one entry per stage transition.
 *
 * Every stage table has a `<next_stage>_planned` column
 * that gates the NEXT stage's pending/history split. How that timestamp gets
 * computed differs per transition — sometimes it's just "now", sometimes it's
 * conditional on a ticket field, sometimes it's a previous stage's completion
 * time plus a configurable TAT (src/pages/Master/tat-config.jsx). Rather than
 * re-deriving that logic inside each stage page's handleSubmit, it's defined
 * once here and each page calls computeStagePlanned(key, ctx).
 *
 * Add a new stage's rule here as each page migrates off the sheet.
 */

import { supabase } from "./client";
import { enquiryTypeList } from "../enquiryType";

/** Enquiry types that send a ticket through the Calibration stage. */
export const CALIBRATION_ENQUIRY_TYPES = ["AUTO-LEVEL-CALIBRATION", "TOTAL-STATION-CALIBRATION"];

/** Duration_minutes for a tat_config row, or `fallbackMinutes` if that stage isn't configured yet. */
export async function getStageTatMinutes(stageName, fallbackMinutes = 60) {
  const { data, error } = await supabase
    .from("inbound_tat_config")
    .select("duration_minutes")
    .eq("stage_name", stageName)
    .maybeSingle();

  if (error) throw error;
  return data?.duration_minutes ?? fallbackMinutes;
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

/**
 * Office-hours config (singleton row) + one-off holiday dates, fetched
 * together so computeStagePlanned() can confine every `<next_stage>_planned`
 * timestamp to actual working time — see addBusinessMinutes() below.
 * Falls back to sensible defaults (10:00-18:00, Sunday off, no holidays) if
 * office_hours somehow has no row yet (it's seeded by migration 0047, so
 * this is just defense-in-depth).
 */
export async function getOfficeHours() {
  const { data, error } = await supabase
    .from("sss_office_hours")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return data || { start_time: "10:00:00", end_time: "18:00:00", weekly_off_days: [0] };
}

export async function getHolidayDates() {
  const { data, error } = await supabase.from("sss_holidays").select("holiday_date");
  if (error) throw error;
  return new Set((data || []).map((h) => h.holiday_date));
}

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isWorkingDay(date, weeklyOffDays, holidayDates) {
  if (weeklyOffDays.includes(date.getDay())) return false;
  if (holidayDates.has(dateKey(date))) return false;
  return true;
}

function parseTimeToMinutes(timeStr) {
  const [h, m] = String(timeStr).split(":").map(Number);
  return h * 60 + (m || 0);
}

function atMinuteOfDay(date, minuteOfDay) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
  return d;
}

function nextDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

/**
 * Adds `minutes` of BUSINESS time to `startDate`, confined to
 * [officeHours.start_time, officeHours.end_time) on working days only
 * (officeHours.weekly_off_days + holidayDates), carrying any leftover TAT
 * minutes over to the next working day's opening time. E.g. office hours
 * 10:00-18:00, submitted at 17:30 with a 60-minute TAT: 30 minutes fit
 * before close today, the remaining 30 roll over to 10:00 the next working
 * day -> planned = 10:30 that day.
 *
 * Falls back to a plain calendar-time addMinutes() if office_hours is
 * misconfigured (end_time <= start_time) rather than looping forever.
 */
export function addBusinessMinutes(startDate, minutes, officeHours, holidayDates) {
  const startMin = parseTimeToMinutes(officeHours.start_time);
  const endMin = parseTimeToMinutes(officeHours.end_time);
  const weeklyOff = officeHours.weekly_off_days || [];

  if (endMin <= startMin) {
    return addMinutes(startDate, minutes);
  }

  let cursor = new Date(startDate);

  // Clamp the starting point into the working window: skip forward past
  // off-days, and past today's close (or up to today's open) as needed.
  while (true) {
    if (!isWorkingDay(cursor, weeklyOff, holidayDates)) {
      cursor = atMinuteOfDay(nextDay(cursor), startMin);
      continue;
    }
    const curMin = cursor.getHours() * 60 + cursor.getMinutes();
    if (curMin < startMin) {
      cursor = atMinuteOfDay(cursor, startMin);
      break;
    }
    if (curMin >= endMin) {
      cursor = atMinuteOfDay(nextDay(cursor), startMin);
      continue;
    }
    break;
  }

  let remaining = minutes;
  while (remaining > 0) {
    const curMin = cursor.getHours() * 60 + cursor.getMinutes();
    const availableToday = endMin - curMin;
    if (remaining <= availableToday) {
      cursor = new Date(cursor.getTime() + remaining * 60000);
      remaining = 0;
    } else {
      remaining -= availableToday;
      cursor = atMinuteOfDay(nextDay(cursor), startMin);
      while (!isWorkingDay(cursor, weeklyOff, holidayDates)) {
        cursor = atMinuteOfDay(nextDay(cursor), startMin);
      }
    }
  }

  return cursor;
}

/**
 * @typedef {Object} StagePlanningRule
 * @property {string} tatStageName - Key into tat_config.stage_name for this transition's TAT.
 * @property {(ctx: Object) => boolean} shouldPlan - Whether this ticket even moves to the next stage.
 *   Returning false means the next stage's page should never see this ticket (planned stays null).
 * @property {(ctx: Object) => Date} baseTime - The timestamp the TAT gets added to.
 */

/** @type {Record<string, StagePlanningRule>} */
export const STAGE_PLANNING_RULES = {
  // Tickets -> Machine Received (Service-Inbound). Stamped on inbound_tickets.machine_received_planned
  // at ticket creation: submit time + tat_config['Machine-Received'].
  machineReceived: {
    tatStageName: "Machine-Received",
    shouldPlan: () => true,
    baseTime: (ctx) => ctx.ticketSubmittedAt,
  },

  // Machine Received -> Quotation (Service-Inbound). Only when Machine-Received = 'yes'; stamped on
  // inbound_material_received.quotation_planned: submit time + tat_config['Quotation'].
  quotationFromMachineReceived: {
    tatStageName: "Quotation",
    shouldPlan: (ctx) => ctx.machineReceived === "yes" || ctx.machineReceived === "quotation_shared",
    baseTime: (ctx) => ctx.machineReceivedSubmittedAt,
  },

  // Follow-Up "Order Received" -> CRM Verification (Service-Inbound). Always planned; stamped on
  // inbound_follow_up.crm_verification_planned: submit time + tat_config['CRM Verification'].
  crmFromOrderReceived: {
    tatStageName: "CRM Verification",
    shouldPlan: () => true,
    baseTime: (ctx) => ctx.orderReceivedSubmittedAt,
  },

  // CRM Verification -> Invoice (stamped on inbound_crm_verification.invoice_planned at CRM submit).
  invoice: {
    tatStageName: "Invoice",
    shouldPlan: () => true,
    baseTime: (ctx) => ctx.orderReceivedSubmittedAt,
  },

  // Invoice -> Calibration (Service-Inbound). Only when inbound_tickets.enquiry_type (text[]) includes
  // AUTO-LEVEL-CALIBRATION or TOTAL-STATION-CALIBRATION; every other ticket skips Calibration
  // (planned stays null). Stamped on inbound_invoice.calibration_planned: invoice submit time + TAT.
  calibration: {
    tatStageName: "Calibration",
    shouldPlan: (ctx) => enquiryTypeList(ctx.ticket?.enquiryType).some((t) => CALIBRATION_ENQUIRY_TYPES.includes(t)),
    baseTime: (ctx) => ctx.invoiceSubmittedAt,
  },

  // Invoice -> Machine Handover (Service-Inbound). Every invoice moves on; stamped on
  // inbound_invoice.machine_handover_planned: invoice submit time + tat_config['Machine-Handover'].
  machineHandover: {
    tatStageName: "Machine-Handover",
    shouldPlan: () => true,
    baseTime: (ctx) => ctx.invoiceSubmittedAt,
  },

  // Calibration -> Calibration Certificate. Every Calibration submission
  // moves on to Calibration Certificate (no branching); base time is
  // Calibration's own submit-time timestamp.
  calibrationCertificate: {
    tatStageName: "Calibration Certificate",
    shouldPlan: () => true,
    baseTime: (ctx) => ctx.calibrationSubmittedAt,
  },
};

/**
 * Computes the `<next_stage>_planned` value for a stage transition, or null
 * if this ticket doesn't move to that stage at all.
 * @param {keyof typeof STAGE_PLANNING_RULES} stageKey
 * @param {Object} ctx - Whatever the rule's shouldPlan/baseTime need (see each rule above).
 * @returns {Promise<string|null>} ISO timestamp, or null.
 */
export async function computeStagePlanned(stageKey, ctx) {
  const rule = STAGE_PLANNING_RULES[stageKey];
  if (!rule) throw new Error(`No planning rule defined for stage "${stageKey}"`);

  if (!rule.shouldPlan(ctx)) return null;

  const [tatMinutes, officeHours, holidayDates] = await Promise.all([
    getStageTatMinutes(rule.tatStageName),
    getOfficeHours(),
    getHolidayDates(),
  ]);
  return addBusinessMinutes(rule.baseTime(ctx), tatMinutes, officeHours, holidayDates).toISOString();
}
