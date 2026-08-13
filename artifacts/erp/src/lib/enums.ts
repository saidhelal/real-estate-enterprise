import { LABELS, type LabelPair } from "@workspace/master-data";
import type { StatusTone } from "@/lib/design-tokens";

export type Lang = "en" | "ar";

// ENUM_LABELS is the central bilingual registry, now sourced from the shared
// @workspace/master-data lib so the Master Data engine seed and the web layer
// share a single source of truth. Add new enum values to the lib's LABELS map.
export const ENUM_LABELS: Record<string, LabelPair> = LABELS;

// ENGINE_LABELS is a runtime registry populated by LookupLabelProvider (see
// lib/lookups.ts) with the admin-managed Master Data values. enumLabel/enumOptions
// consult it first so renamed/added labels show everywhere without per-page edits;
// it falls back to the static ENUM_LABELS registry until the engine values load.
let ENGINE_LABELS: Record<string, LabelPair> = {};

export function setEngineLabels(map: Record<string, LabelPair>): void {
  ENGINE_LABELS = map;
}

function labelEntry(value: string): LabelPair | undefined {
  return ENGINE_LABELS[value] ?? ENUM_LABELS[value];
}

export const CRM_CLASSIFICATIONS = [
  "interested",
  "follow_up",
  "initial_reservation",
  "reserved",
  "contracted",
  "not_interested",
  "postponed",
  "former",
] as const;

export function enumLabel(value: string | null | undefined, lang: Lang): string {
  if (!value) return "-";
  const entry = labelEntry(value);
  return entry ? entry[lang] : value;
}

export interface EnumOption {
  value: string;
  label: string;
  labelAr: string;
}

export function enumOptions(values: string[]): EnumOption[] {
  return values.map((v) => {
    const e = labelEntry(v);
    return { value: v, label: e?.en ?? v, labelAr: e?.ar ?? v };
  });
}

/**
 * Status value → semantic tone.
 *
 * This module already owns what a status *says*; this is what it *means*. Nine
 * screens each carried their own copy of this mapping, which is why a posted
 * journal entry and a posted voucher could be coloured differently. The
 * vocabulary itself is shared — `posted` means the same thing in accounting as
 * it does in procurement — so the mapping belongs with the vocabulary rather
 * than with whichever screen renders it.
 *
 * Anything unlisted is deliberately `neutral`: an unrecognised status must read
 * as "no opinion", never as success. Where a module genuinely disagrees, it
 * passes an explicit `tone` to `StatusBadge` instead of editing this map.
 */
const STATUS_TONES: Record<string, StatusTone> = {
  // Reached its intended end state.
  posted: "success",
  paid: "success",
  collected: "success",
  active: "success",
  approved_final: "success",
  completed: "success",
  closed: "success",
  delivered: "success",
  viewed: "success",

  // Moving, and moving normally. Nothing is required of the reader yet.
  approved: "info",
  under_collection: "info",
  received: "info",
  in_progress: "info",
  submitted: "info",
  pending_finance: "info",
  finance_approved: "info",

  // Stalled, or short of what it should be. Someone has to act.
  partially_paid: "warning",
  pending: "warning",
  pending_approval: "warning",
  on_hold: "warning",
  overdue: "warning",
  expiring_soon: "warning",

  // Ended badly, or was undone.
  reversed: "error",
  cancelled: "error",
  rejected: "error",
  returned: "error",
  replaced: "error",
  expired: "error",
  failed: "error",
};

export function statusTone(value: string | null | undefined): StatusTone {
  if (!value) return "neutral";
  return STATUS_TONES[value] ?? "neutral";
}
