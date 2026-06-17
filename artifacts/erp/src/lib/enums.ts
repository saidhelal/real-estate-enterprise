import { LABELS, type LabelPair } from "@workspace/master-data";

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
