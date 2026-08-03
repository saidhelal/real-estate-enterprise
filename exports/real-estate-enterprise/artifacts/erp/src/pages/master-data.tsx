import { useState } from "react";
import {
  useListLookupTypes,
  getListLookupTypesQueryKey,
  type LookupType,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LookupValuesManager } from "@/components/master-data/lookup-values-manager";
import { cn } from "@/lib/utils";

export default function MasterDataPage() {
  const { t, language } = useLanguage();
  const params = { pageSize: 200 };
  const { data, isLoading } = useListLookupTypes(params, {
    query: { queryKey: getListLookupTypesQueryKey(params) },
  });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LookupType | null>(null);

  const types = (data?.data ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const filtered = types.filter((type) => {
    const q = search.toLowerCase();
    return (
      type.code.toLowerCase().includes(q) ||
      type.nameEn.toLowerCase().includes(q) ||
      type.nameAr.includes(search)
    );
  });

  const typeName = (type: LookupType) => (language === "ar" ? type.nameAr : type.nameEn);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("master_data.title")}</h2>
        <p className="text-muted-foreground">{t("master_data.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <Input
            placeholder={t("master_data.search_categories")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="rounded-md border bg-card">
            <ScrollArea className="h-[600px]">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">{t("common.no_results")}</div>
              ) : (
                <ul className="divide-y">
                  {filtered.map((type) => (
                    <li key={type.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(type)}
                        className={cn(
                          "flex w-full flex-col items-start gap-1 px-4 py-3 text-start transition-colors hover:bg-accent",
                          selected?.id === type.id && "bg-accent",
                        )}
                      >
                        <span className="font-medium">{typeName(type)}</span>
                        <span className="font-mono text-xs text-muted-foreground">{type.code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <div className="rounded-md border bg-card p-6">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{typeName(selected)}</h3>
                {selected.isSystem && <Badge variant="outline">{t("master_data.system")}</Badge>}
              </div>
              <LookupValuesManager typeId={selected.id} />
            </div>
          ) : (
            <div className="flex h-full min-h-[400px] items-center justify-center text-center text-muted-foreground">
              {t("master_data.select_category")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
