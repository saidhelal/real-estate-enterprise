import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useListLookupValues,
  getListLookupValuesQueryKey,
  listLookupValues,
  type LookupValue,
} from "@workspace/api-client-react";
import { LABELS, type LabelPair } from "@workspace/master-data";
import { ENUM_LABELS, setEngineLabels, type Lang } from "./enums";

export interface LookupOption {
  value: string;
  labelEn: string;
  labelAr: string;
}

// SelectOption mirrors the ResourceManager field-option shape ({value,label,labelAr})
// so useLookupOptions can feed module form/filter selects directly.
export interface SelectOption {
  value: string;
  label: string;
  labelAr?: string;
}

// useLookupValues — fetch the active (non-archived) values for a lookup category
// by its type code, ready to drive a select/option list in module forms. The
// follow-on rollout wires module forms to this hook; until then it backs the
// Master Data UI's resolver fallback path.
export function useLookupValues(typeCode: string, enabled = true) {
  const query = useListLookupValues(
    { typeCode, active: true, archived: false, pageSize: 200 },
    {
      query: {
        queryKey: getListLookupValuesQueryKey({
          typeCode,
          active: true,
          archived: false,
          pageSize: 200,
        }),
        enabled: enabled && typeCode.length > 0,
      },
    },
  );

  const values: LookupValue[] = query.data?.data ?? [];
  const options: LookupOption[] = values.map((v) => ({
    value: v.code,
    labelEn: v.labelEn,
    labelAr: v.labelAr,
  }));

  return { ...query, values, options };
}

// resolveLookupLabel — resolve a stored code to its EN/AR label, preferring the
// admin-managed engine values and falling back to the central ENUM_LABELS
// registry (and finally the raw code) so nothing ever renders blank. Pass the
// values array from useLookupValues for the engine-aware path; without it the
// registry fallback alone is used.
export function resolveLookupLabel(
  code: string | null | undefined,
  lang: Lang,
  values?: LookupValue[],
): string {
  if (!code) return "-";
  const match = values?.find((v) => v.code === code);
  if (match) return lang === "ar" ? match.labelAr : match.labelEn;
  const entry = ENUM_LABELS[code];
  return entry ? entry[lang] : code;
}

// useLookupOptions — drive a module form/filter select from the Master Data engine.
// When the category has live engine rows, those are authoritative: the select shows
// exactly the active (non-archived) admin-managed values, so admin-ADDED values appear
// and admin-ARCHIVED values disappear with no code change. Only when the engine has no
// rows for the category (unseeded) do the supplied static codes drive the select, so a
// form never renders empty. This hook must therefore only be wired to a field whose
// static option set is a subset of the matching LOOKUP_CATEGORIES category; fields with
// page-only codes outside any category, or with no true matching category, stay
// hardcoded via enumOptions. The stored value is always the snake_case code, unchanged.
// `values` is returned for callers that also need the engine-aware label resolver.
export function useLookupOptions(typeCode: string, fallbackCodes: string[] = []) {
  const { values, options, isLoading, ...rest } = useLookupValues(typeCode);
  const selectOptions: SelectOption[] =
    options.length > 0
      ? options.map((o) => ({ value: o.value, label: o.labelEn, labelAr: o.labelAr }))
      : fallbackCodes.map((code) => {
          const entry = ENUM_LABELS[code];
          return { value: code, label: entry?.en ?? code, labelAr: entry?.ar ?? code };
        });
  return { ...rest, isLoading, values, options: selectOptions };
}

const ALL_VALUES_QUERY_KEY = ["lookup-values", "all-active"] as const;

async function fetchAllActiveLookupValues(): Promise<LookupValue[]> {
  const pageSize = 200;
  let page = 1;
  const all: LookupValue[] = [];
  // The list endpoint caps pageSize at 200, so page through until exhausted.
  for (;;) {
    const res = await listLookupValues({ active: true, archived: false, page, pageSize });
    all.push(...res.data);
    if (all.length >= res.total || res.data.length === 0) break;
    page += 1;
  }
  return all;
}

// LookupLabelProvider — mounted once at the app root. It fetches every active engine
// value and merges them into the runtime ENGINE_LABELS registry (static LABELS as the
// base), so every enumLabel/enumOptions call across the app renders admin-managed
// labels with no per-page wiring. Codes are globally unique in the registry, matching
// the static LABELS contract.
export function LookupLabelProvider({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: ALL_VALUES_QUERY_KEY,
    queryFn: fetchAllActiveLookupValues,
    staleTime: 30_000,
  });

  useEffect(() => {
    const merged: Record<string, LabelPair> = { ...LABELS };
    for (const v of data ?? []) {
      merged[v.code] = { en: v.labelEn, ar: v.labelAr };
    }
    setEngineLabels(merged);
  }, [data]);

  return children as React.ReactElement;
}
