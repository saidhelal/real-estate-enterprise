import { useState } from "react";
import {
  useListUnits,
  getListUnitsQueryKey,
  useListUnitStatuses,
  type Unit,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-provider";
import { StartSaleDialog } from "@/components/sales/start-sale-dialog";
import { SlidersHorizontal, PlayCircle, ArrowRight } from "lucide-react";

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

  const [saleUnit, setSaleUnit] = useState<Unit | null>(null);
  const [open, setOpen] = useState(false);
  const startSale = (u: Unit) => { setSaleUnit(u); setOpen(true); };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.available_units")}</h1>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "الوحدات المتاحة للبيع. اضغط ابدأ البيع لبدء دورة البيع الكاملة."
              : "Units available for sale. Press Start Sale to launch the full sales workflow."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/crm-sales">
            <Button variant="outline" size="sm">
              <ArrowRight className="h-4 w-4 me-1" />
              {ar ? "لوحة سير البيع" : "Sales Workflow"}
            </Button>
          </Link>
          <Link href="/data-entry-center">
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="h-4 w-4 me-1" />
              {ar ? "مركز إدخال البيانات" : "Data Entry Center"}
            </Button>
          </Link>
        </div>
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
            <Card key={u.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="font-medium">{u.code}</span>
                  <Badge variant="secondary">{ar ? "متاحة" : "Available"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-1 text-sm text-muted-foreground">
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
                <Button className="mt-3 w-full" onClick={() => startSale(u)}>
                  <PlayCircle className="h-4 w-4 me-1" />
                  {ar ? "ابدأ البيع" : "Start Sale"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <StartSaleDialog unit={saleUnit} open={open} onOpenChange={setOpen} />
    </div>
  );
}
