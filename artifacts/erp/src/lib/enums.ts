import { LABELS, type LabelPair } from "@workspace/master-data";

export type Lang = "en" | "ar";

// ENUM_LABELS is the central bilingual registry, now sourced from the shared
// @workspace/master-data lib so the Master Data engine seed and the web layer
// share a single source of truth. Add new enum values to the lib's LABELS map.
export const ENUM_LABELS: Record<string, LabelPair> = LABELS;

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
  const entry = ENUM_LABELS[value];
  return entry ? entry[lang] : value;
}

export interface EnumOption {
  value: string;
  label: string;
  labelAr: string;
}

export function enumOptions(values: string[]): EnumOption[] {
  return values.map((v) => {
    const e = ENUM_LABELS[v];
    return { value: v, label: e?.en ?? v, labelAr: e?.ar ?? v };
  });
}
