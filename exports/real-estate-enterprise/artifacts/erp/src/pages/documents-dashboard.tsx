import { Link } from "wouter";
import {
  useGetDocumentsDashboard,
  getGetDocumentsDashboardQueryKey,
  useListCompanies,
  type Document,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function DocumentsDashboardPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const dashParams = companyId ? { companyId } : undefined;
  const { data, isLoading } = useGetDocumentsDashboard(dashParams, {
    query: { enabled: !!companyId, queryKey: getGetDocumentsDashboardQueryKey(dashParams) },
  });

  const totals = data?.totals;
  const byModule = data?.byModule ?? [];
  const recent: Document[] = data?.recent ?? [];

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("edms.dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("edms.subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/documents">{t("nav.documents")}</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Stat label={t("edms.kpi.total")} value={isLoading ? "…" : (totals?.total ?? 0)} />
        <Stat label={t("edms.kpi.active")} value={isLoading ? "…" : (totals?.active ?? 0)} />
        <Stat label={t("edms.kpi.pending")} value={isLoading ? "…" : (totals?.pendingApproval ?? 0)} />
        <Stat label={t("edms.kpi.archived")} value={isLoading ? "…" : (totals?.archived ?? 0)} />
        <Stat label={t("edms.kpi.expired")} value={isLoading ? "…" : (totals?.expired ?? 0)} />
        <Stat label={t("edms.kpi.recent")} value={isLoading ? "…" : (totals?.recentlyAdded ?? 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("edms.by_module")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("edms.module")}</TableHead>
                  <TableHead className="text-right">{t("edms.kpi.total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byModule.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                      {t("edms.no_documents")}
                    </TableCell>
                  </TableRow>
                ) : (
                  byModule.map((m) => (
                    <TableRow key={m.moduleKey}>
                      <TableCell>
                        <Badge variant="secondary">{enumLabel(m.moduleKey, language)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{m.count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("edms.recent_documents")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("edms.document_number")}</TableHead>
                  <TableHead>{t("edms.name")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      {t("edms.no_documents")}
                    </TableCell>
                  </TableRow>
                ) : (
                  recent.map((d) => (
                    <TableRow key={d.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={`/documents/${d.id}`} className="text-primary hover:underline">
                          {d.documentNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{language === "ar" ? (d.nameAr ?? d.name) : d.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{enumLabel(d.status, language)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
