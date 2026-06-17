import {
  useListLookupValues,
  getListLookupValuesQueryKey,
  type LookupValue,
} from "@workspace/api-client-react";
import { ENUM_LABELS, type Lang } from "./enums";

export interface LookupOption {
  value: string;
  labelEn: string;
  labelAr: string;
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
