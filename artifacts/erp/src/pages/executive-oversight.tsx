import {
  useGetExecutiveOversight,
  getGetExecutiveOversightQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  TrendingUp,
  CircleDollarSign,
  Wallet,
  Calculator,
  Users,
  Building,
  HardHat,
  ShoppingCart,
  Package,
  UserCog,
  Scale,
  MessageSquare,
  FileBox,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/lib/language-provider";

const DEPT_ICONS: Record<string, LucideIcon> = {
  sales: TrendingUp,
  collections: CircleDollarSign,
  finance: Wallet,
  accounting: Calculator,
  crm: Users,
  realEstate: Building,
  construction: HardHat,
  procurement: ShoppingCart,
  inventory: Package,
  hr: UserCog,
  legal: Scale,
  customerService: MessageSquare,
  fixedAssets: FileBox,
  insurance: ShieldCheck,
};

const TONE_CLASS: Record<string, string> = {
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
  success: "text-emerald-600 dark:text-emerald-400",
};

export default function ExecutiveOversightPage() {
  const { t, language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading, refetch } = useGetExecutiveOversight(params, {
    query: { enabled: !!companyId, queryKey: getGetExecutiveOversightQueryKey(params) },
  });

  const locale = language === "ar" ? "ar-EG" : "en-US";
  const moneyFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const countFmt = new Intl.NumberFormat(locale);

  const formatValue = (value: string, kind: string): string => {
    if (kind === "money") return moneyFmt.format(Number(value) || 0);
    if (kind === "percent") return `${value}%`;
    return countFmt.format(Number(value) || 0);
  };

  const generatedAt = data?.generatedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(data.generatedAt),
      )
    : null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("eo.title")}</h2>
          <p className="text-muted-foreground">{t("eo.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {generatedAt ? (
            <span className="text-xs text-muted-foreground">
              {t("eo.generated_at")}: {generatedAt}
            </span>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isLoading}
            data-testid="button-refresh-oversight"
          >
            <RefreshCw className="me-2 h-4 w-4" />
            {t("eo.refresh")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data?.departments ?? []).map((dept) => {
            const Icon = DEPT_ICONS[dept.key] ?? TrendingUp;
            return (
              <Card key={dept.key} data-testid={`card-dept-${dept.key}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    {t(`eo.dept.${dept.key}`)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="divide-y divide-border">
                    {dept.kpis.map((kpi) => (
                      <div
                        key={kpi.key}
                        className="flex items-center justify-between py-2"
                        data-testid={`kpi-${dept.key}-${kpi.key}`}
                      >
                        <dt className="text-sm text-muted-foreground">{t(`eo.kpi.${kpi.key}`)}</dt>
                        <dd className={`text-sm font-semibold tabular-nums ${kpi.tone ? TONE_CLASS[kpi.tone] ?? "" : ""}`}>
                          {formatValue(kpi.value, kpi.kind)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
