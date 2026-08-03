import { Link } from "wouter";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-provider";

interface ReportLink {
  href: string;
  titleKey: string;
}

const REPORTS: ReportLink[] = [
  { href: "/trial-balance", titleKey: "nav.trial_balance" },
  { href: "/balance-sheet", titleKey: "nav.balance_sheet" },
  { href: "/income-statement", titleKey: "nav.income_statement" },
  { href: "/cash-flow", titleKey: "nav.cash_flow" },
  { href: "/general-ledger", titleKey: "nav.general_ledger" },
  { href: "/budget-vs-actual", titleKey: "nav.budget_vs_actual" },
];

export default function FinancialReportsPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("nav.financial_reports")}</h1>
        <p className="text-muted-foreground">{t("acc.reports_hub_subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.href} className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle>{t(r.titleKey)}</CardTitle>
              <CardDescription>{t("acc.reports_hub_subtitle")}</CardDescription>
            </CardHeader>
            <div className="p-6 pt-0">
              <Link href={r.href}>
                <Button variant="outline" className="w-full">
                  {t("acc.open_report")}
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
