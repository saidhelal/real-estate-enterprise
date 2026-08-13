import { useEffect, useState } from "react";
import {
  useListContracts,
  getListContractsQueryKey,
  useListUnits,
  useListCustomers,
  useListCompanies,
  type Contract,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-provider";
import { useAuth } from "@/lib/auth-provider";
import { ContractStageActions } from "@/components/sales/contract-stage-actions";
import {
  saleStage,
  stageLabel,
  isLiveStage,
  trafficLight,
  TRAFFIC_DOT,
  TRAFFIC_RING,
  TRAFFIC_TEXT,
  formatElapsed,
  formatRemaining,
  isManagerial,
  paymentMethodLabel,
  type SaleStage,
} from "@/lib/sale-workflow";
import {
  BookMarked,
  FileSignature,
  Wallet,
  ArrowRightLeft,
  FileX,
  AlertTriangle,
} from "lucide-react";

/** Ticks every 60s so elapsed/remaining timers stay live. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const PIPELINE: SaleStage[] = ["returned", "draft", "pending_finance", "finance_approved", "active"];

export default function CrmSalesPage() {
  const { language, t } = useLanguage();
  const ar = language === "ar";
  const { user } = useAuth();
  const now = useNow();
  const managerial = isManagerial(user);

  const p = { pageSize: 200 } as const;
  const { data: contracts, isLoading } = useListContracts(p, { query: { queryKey: getListContractsQueryKey(p) } });
  const { data: units } = useListUnits(p);
  const { data: customers } = useListCustomers(p);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const customerName = (id: string) => customers?.data.find((c) => c.id === id)?.fullName ?? id;
  const unitCode = (id: string) => units?.data.find((u) => u.id === id)?.code ?? id;

  const all = contracts?.data ?? [];
  const byStage = (s: SaleStage) => all.filter((c) => saleStage(c) === s);

  // Escalation: live contracts that are red/orange on the traffic light.
  const alerts = all
    .filter((c) => isLiveStage(saleStage(c)))
    .filter((c) => {
      const light = trafficLight(c, now);
      return light === "red" || light === "orange";
    });

  const elapsedFrom = (c: Contract) => c.submittedToFinanceAt ?? c.contractDate;

  const ContractRow = ({ c }: { c: Contract }) => {
    const light = trafficLight(c, now);
    const stage = saleStage(c);
    return (
      <div className={`rounded-md border p-3 space-y-2 ${TRAFFIC_RING[light]}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium">
            <span className={`h-2.5 w-2.5 rounded-full ${TRAFFIC_DOT[light]}`} title={light} />
            {c.code}
          </span>
          <Badge variant={stage === "active" ? "default" : stage === "returned" ? "destructive" : "outline"}>
            {stageLabel(stage, ar)}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{ar ? "العميل" : "Customer"}: {customerName(c.customerId)}</span>
          <span>{ar ? "الوحدة" : "Unit"}: {unitCode(c.unitId)}</span>
          <span>{ar ? "القيمة" : "Total"}: {c.totalPrice}</span>
          <span>{ar ? "الدفع" : "Payment"}: {paymentMethodLabel(c.paymentMethod, ar)}</span>
        </div>
        {isLiveStage(stage) ? (
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
            <span className="text-muted-foreground">
              {ar ? "المنقضي" : "Elapsed"}: {formatElapsed(elapsedFrom(c), ar, now)}
            </span>
            {stage === "pending_finance" && c.financeSlaDueAt ? (
              <span className={light === "red" ? `font-medium ${TRAFFIC_TEXT.red}` : "text-muted-foreground"}>
                SLA: {formatRemaining(c.financeSlaDueAt, ar, now)}
              </span>
            ) : null}
          </div>
        ) : null}
        <ContractStageActions contract={c} companyId={companyId} />
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("nav.crm_sales")}
        description={ar
          ? "لوحة سير عمليات البيع — تابع حالة كل عقد عبر مراحله. تتم اعتمادات المالية داخل وحدة المالية والاعتمادات القانونية داخل وحدة الشؤون القانونية."
          : "Operational sales workflow — track each contract's status through its stages. Finance approvals happen in the Finance module and legal approvals in the Legal Affairs module."}
        bordered={false}
      />

      {/* Managerial escalation banner */}
      {managerial && alerts.length > 0 ? (
        <Card className="border-destructive-border/50 bg-destructive-subtle/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-destructive-subtle-foreground">
              <AlertTriangle className="h-4 w-4" />
              {ar ? `تنبيهات تأخير (${alerts.length})` : `Delayed alerts (${alerts.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {alerts.map((c) => {
              const light = trafficLight(c, now);
              return (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${TRAFFIC_DOT[light]}`} />
                    <span className="font-medium">{c.code}</span>
                    <span className="text-muted-foreground">{unitCode(c.unitId)} · {customerName(c.customerId)}</span>
                    <Badge variant="outline">{stageLabel(saleStage(c), ar)}</Badge>
                  </span>
                  <span className={light === "red" ? `font-medium ${TRAFFIC_TEXT.red}` : TRAFFIC_TEXT.orange}>
                    {c.financeSlaDueAt
                      ? formatRemaining(c.financeSlaDueAt, ar, now)
                      : formatElapsed(elapsedFrom(c), ar, now)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {/* Pipeline */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : all.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {ar
            ? "لا توجد عقود بعد. ابدأ من صفحة الوحدات المتاحة بالضغط على ابدأ البيع."
            : "No contracts yet. Start from Available Units by pressing Start Sale."}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {PIPELINE.map((stage) => {
            const rows = byStage(stage);
            return (
              <Card key={stage} className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span>{stageLabel(stage, ar)}</span>
                    <Badge variant="secondary">{rows.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{ar ? "لا يوجد" : "None"}</p>
                  ) : (
                    rows.map((c) => <ContractRow key={c.id} c={c} />)
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail pages */}
      <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { icon: BookMarked, title: ar ? "الحجوزات" : "Reservations", href: "/reservations" },
          { icon: FileSignature, title: ar ? "العقود" : "Contracts", href: "/contracts" },
          { icon: Wallet, title: ar ? "مدفوعات الحجز" : "Reservation Payments", href: "/reservation-payments" },
          { icon: ArrowRightLeft, title: ar ? "تحويل الوحدات" : "Unit Transfers", href: "/unit-transfers" },
          { icon: FileX, title: ar ? "إلغاء العقود" : "Contract Cancellations", href: "/contract-cancellations" },
        ].map(({ icon: Icon, title, href }) => (
          <Link key={href} href={href}>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Icon className="h-4 w-4 me-1" />
              {title}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );
}
