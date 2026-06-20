import {
  useListUnits,
  getListUnitsQueryKey,
  useListUnitStatuses,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-provider";
import { SlidersHorizontal } from "lucide-react";

export default function CrmAvailableUnitsPage() {
  const { language, t } = useLanguage();
  const ar = language === "ar";

  const p = { pageSize: 200 } as const;
  const { data: units, isLoading } = useListUnits(p, { query: { queryKey: getListUnitsQueryKey(p) } });
  const { data: unitStatuses } = useListUnitStatuses({ pageSize: 200 });
  const statusCodeById = new Map((unitStatuses?.data ?? []).map((s) => [s.id, s.code]));

  const available = (units?.data ?? []).filter(
    (u) => (u.unitStatusId ? statusCodeById.get(u.unitStatusId) : undefined) === "available" && u.salesAvailable,
  );

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.available_units")}</h1>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "الوحدات المنشورة للبيع من مركز إدخال البيانات. الإدارة من مركز إدخال البيانات."
              : "Units published for sale from the Data Entry Center. Managed in the Data Entry Center."}
          </p>
        </div>
        <Link href="/data-entry-center">
          <Button variant="outline" size="sm">
            <SlidersHorizontal className="h-4 w-4 mr-1" />
            {ar ? "مركز إدخال البيانات" : "Data Entry Center"}
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : available.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {ar ? "لا توجد وحدات متاحة منشورة للبيع حالياً" : "No available units published for sale yet"}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((u) => (
            <Card key={u.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="font-medium">{u.code}</span>
                  <Badge variant="secondary">{ar ? "متاحة" : "Available"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <div>{u.name}</div>
                {u.totalPrice != null ? (
                  <div>{ar ? "السعر الإجمالي" : "Total Price"}: {u.totalPrice}</div>
                ) : null}
                {u.pricePerMeter != null ? (
                  <div>{ar ? "سعر المتر" : "Price/m"}: {u.pricePerMeter}</div>
                ) : null}
                {u.minSellingPrice != null ? (
                  <div>{ar ? "أقل سعر بيع" : "Min Selling"}: {u.minSellingPrice}</div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
