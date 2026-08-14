import type { CurrentUser } from "@workspace/api-client-react";

/**
 * Operational sales workflow helpers shared by the Available Units screen, the
 * Start Sale dialog, and the Sales Workflow board. The canonical contract
 * lifecycle lives on the server (sales.ts): draft -> pending_finance ->
 * finance_approved -> active (and rejected / cancelled terminals). The unit is
 * derived: an in-progress contract locks the unit as "pending_sale", an active
 * contract makes it "sold", and a cancellation frees it back to "available".
 */

export type SaleStage =
  | "draft"
  | "returned"
  | "pending_finance"
  | "finance_approved"
  | "active"
  | "rejected"
  | "cancelled"
  | "other";

export interface StageContract {
  status: string;
  financeReviewedAt?: string | null;
}

/** Resolve the operational stage from a contract row. */
export function saleStage(c: StageContract): SaleStage {
  switch (c.status) {
    case "draft":
      return c.financeReviewedAt ? "returned" : "draft";
    case "pending_finance":
      return "pending_finance";
    case "finance_approved":
      return "finance_approved";
    case "active":
      return "active";
    case "rejected":
      return "rejected";
    case "cancelled":
      return "cancelled";
    default:
      return "other";
  }
}

export function stageLabel(stage: SaleStage, ar: boolean): string {
  const en: Record<SaleStage, string> = {
    draft: "Contract Draft",
    returned: "Returned to Sales",
    pending_finance: "At Finance",
    finance_approved: "At Legal",
    active: "Active — Sold",
    rejected: "Rejected",
    cancelled: "Cancelled",
    other: "—",
  };
  const arL: Record<SaleStage, string> = {
    draft: "مسودة عقد",
    returned: "مُعاد إلى المبيعات",
    pending_finance: "لدى المالية",
    finance_approved: "لدى الشؤون القانونية",
    active: "مفعّل — مباع",
    rejected: "مرفوض",
    cancelled: "ملغى",
    other: "—",
  };
  return ar ? arL[stage] : en[stage];
}

/** A live stage is one where the unit is still locked (pending_sale). */
export function isLiveStage(stage: SaleStage): boolean {
  return stage === "draft" || stage === "returned" || stage === "pending_finance" || stage === "finance_approved";
}

export type TrafficLight = "green" | "yellow" | "orange" | "red";

export interface SlaContract extends StageContract {
  financeSlaDueAt?: string | null;
  submittedToFinanceAt?: string | null;
}

/**
 * Traffic-light health for a contract. Finance SLA (financeSlaDueAt) drives the
 * pending_finance stage; a contract returned to sales is always an attention
 * (orange) item; active/terminal stages are green.
 */
export function trafficLight(c: SlaContract, now: number = Date.now()): TrafficLight {
  const stage = saleStage(c);
  if (stage === "returned") return "orange";
  if (stage === "pending_finance" && c.financeSlaDueAt) {
    const remainingMs = new Date(c.financeSlaDueAt).getTime() - now;
    if (remainingMs <= 0) return "red";
    const hrs = remainingMs / 3_600_000;
    if (hrs < 6) return "orange";
    if (hrs < 24) return "yellow";
    return "green";
  }
  return "green";
}

/**
 * The four SLA levels, drawn from the theme's status tokens.
 *
 * The scale has one more step than the token set does, because `orange` means
 * "under six hours left" and needs to read as more urgent than `yellow` without
 * yet claiming the breach that `red` reports. Rather than introduce a fifth
 * colour that nothing else in the app uses, `orange` is a lighter destructive —
 * so the ladder still runs success → warning → breach-imminent → breached, and
 * it still recolours correctly when the theme changes.
 */
export const TRAFFIC_DOT: Record<TrafficLight, string> = {
  green: "bg-success",
  yellow: "bg-warning",
  orange: "bg-destructive/70",
  red: "bg-destructive",
};

export const TRAFFIC_RING: Record<TrafficLight, string> = {
  green: "border-success-border/40",
  yellow: "border-warning-border/50",
  orange: "border-destructive-border/40",
  red: "border-destructive-border/60",
};

/** Text/icon tint for the same four levels, for use on the page background. */
export const TRAFFIC_TEXT: Record<TrafficLight, string> = {
  green: "text-success-subtle-foreground",
  yellow: "text-warning-subtle-foreground",
  orange: "text-destructive-subtle-foreground/80",
  red: "text-destructive-subtle-foreground",
};

/** Format an elapsed duration (since `fromISO`) as days / hours / minutes. */
export function formatElapsed(fromISO: string | null | undefined, ar: boolean, now: number = Date.now()): string {
  if (!fromISO) return "—";
  let ms = now - new Date(fromISO).getTime();
  if (ms < 0) ms = 0;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (ar) return `${days} ي ${hours} س ${mins} د`;
  return `${days}d ${hours}h ${mins}m`;
}

/** Format remaining time until a due date (negative => overdue). */
export function formatRemaining(dueISO: string | null | undefined, ar: boolean, now: number = Date.now()): string {
  if (!dueISO) return "—";
  const ms = new Date(dueISO).getTime() - now;
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const mins = Math.floor((abs % 3_600_000) / 60_000);
  const body = ar ? `${days} ي ${hours} س ${mins} د` : `${days}d ${hours}h ${mins}m`;
  if (overdue) return ar ? `متأخر ${body}` : `${body} overdue`;
  return ar ? `متبقٍ ${body}` : `${body} left`;
}

/** Managers, executive managers and owners (or a wildcard role) see escalation alerts. */
export function isManagerial(user: CurrentUser | null): boolean {
  if (!user) return false;
  if (user.permissions?.includes("*")) return true;
  const roles = (user.roles ?? []).join(" ").toLowerCase();
  return /manager|owner|executive|director|admin|مدير|مالك|تنفيذي/.test(roles);
}

/*
 * `genCode` was here, and it is deliberately not replaced.
 *
 * It built a business code in the browser from a timestamp and a random
 * suffix, and six call sites used it for reservations, installment plans,
 * cheques, receipts and customers. A code the client invents is not an
 * identifier — two browsers can invent the same one, and nothing in the
 * database was watching.
 *
 * All six of those entities are issued from the central sequence engine on
 * save, so the value was already being discarded by the server; the call sites
 * only ever used the record that came back. The generator is gone rather than
 * left unused, so it cannot be reached for again.
 *
 * A form that needs to show the number before saving asks the server:
 * GET /api/number-preview?documentType=... — the same engine that will issue
 * it. See `ResourceField.generated` / `generatorKey`.
 */

export type Frequency = "monthly" | "quarterly" | "semi_annual" | "annual" | "custom";

export const FREQUENCY_MONTHS: Record<Frequency, number> = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
  custom: 1,
};

export function frequencyLabel(f: Frequency, ar: boolean): string {
  const en: Record<Frequency, string> = {
    monthly: "Monthly",
    quarterly: "Quarterly",
    semi_annual: "Semi-annual",
    annual: "Annual",
    custom: "Custom",
  };
  const arL: Record<Frequency, string> = {
    monthly: "شهري",
    quarterly: "ربع سنوي",
    semi_annual: "نصف سنوي",
    annual: "سنوي",
    custom: "مخصص",
  };
  return ar ? arL[f] : en[f];
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Guard month overflow (e.g. Jan 31 + 1mo).
  if (d.getDate() < day) d.setDate(0);
  return d;
}

export interface ScheduleRow {
  installmentNumber: number;
  dueDate: string; // YYYY-MM-DD
  amount: string; // 2-decimal string
}

/**
 * Build an installment schedule. The financed amount (total - down payment) is
 * split into `count` installments; rounding remainder is folded into the last
 * one so the rows sum exactly to the financed amount.
 */
export function buildSchedule(
  financed: number,
  count: number,
  frequency: Frequency,
  startDate: string,
): ScheduleRow[] {
  if (!Number.isFinite(financed) || financed <= 0 || count < 1) return [];
  const step = FREQUENCY_MONTHS[frequency] ?? 1;
  const start = new Date(startDate + "T00:00:00");
  const baseCents = Math.floor((financed * 100) / count);
  const rows: ScheduleRow[] = [];
  let allocated = 0;
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const cents = isLast ? Math.round(financed * 100) - allocated : baseCents;
    allocated += cents;
    const due = addMonths(start, step * i);
    rows.push({
      installmentNumber: i + 1,
      dueDate: due.toISOString().slice(0, 10),
      amount: (cents / 100).toFixed(2),
    });
  }
  return rows;
}

export function paymentMethodLabel(m: string | null | undefined, ar: boolean): string {
  switch (m) {
    case "cash":
      return ar ? "نقدي" : "Cash";
    case "installments":
      return ar ? "أقساط" : "Installments";
    case "cash_installments":
      return ar ? "نقدي + أقساط" : "Cash + Installments";
    default:
      return ar ? "غير محدد" : "—";
  }
}
