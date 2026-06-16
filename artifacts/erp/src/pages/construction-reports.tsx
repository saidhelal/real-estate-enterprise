import { useQuery } from "@tanstack/react-query";
import {
  useListCompanies,
  listContractors,
  listContractorContracts,
  listPaymentCertificates,
  listRetentions,
  listAdvancePayments,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";

function num(v: string | null | undefined): number {
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ConstructionReportsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const enabled = !!companyId;

  // The server caps pageSize at 200, so reports must page through every row to
  // aggregate accurate totals rather than truncating at a single page.
  async function fetchAll<T>(
    fn: (params: { page: number; pageSize: number; companyId?: string }) => Promise<{ data: T[]; total: number }>,
  ): Promise<T[]> {
    const pageSize = 200;
    const out: T[] = [];
    let page = 1;
    for (;;) {
      const res = await fn({ page, pageSize, companyId });
      out.push(...res.data);
      if (out.length >= res.total || res.data.length === 0) break;
      page += 1;
    }
    return out;
  }

  const { data: contractors = [] } = useQuery({
    queryKey: ["report", "contractors", companyId],
    queryFn: () => fetchAll((p) => listContractors(p)),
    enabled,
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["report", "contracts", companyId],
    queryFn: () => fetchAll((p) => listContractorContracts(p)),
    enabled,
  });
  const { data: certs = [] } = useQuery({
    queryKey: ["report", "certs", companyId],
    queryFn: () => fetchAll((p) => listPaymentCertificates(p)),
    enabled,
  });
  const { data: retentions = [] } = useQuery({
    queryKey: ["report", "retentions", companyId],
    queryFn: () => fetchAll((p) => listRetentions(p)),
    enabled,
  });
  const { data: advances = [] } = useQuery({
    queryKey: ["report", "advances", companyId],
    queryFn: () => fetchAll((p) => listAdvancePayments(p)),
    enabled,
  });

  const contractorName = (id: string | null | undefined) => {
    const c = contractors.find((x) => x.id === id);
    if (!c) return "-";
    return (language === "ar" ? c.nameAr : c.name) ?? c.name ?? "-";
  };
  const contractLabel = (id: string | null | undefined) => {
    const c = contracts.find((x) => x.id === id);
    return c?.code ?? "-";
  };

  // Contract financial summary: certified per contract
  const certifiedByContract = new Map<string, number>();
  for (const cert of certs) {
    if (!cert.contractId) continue;
    certifiedByContract.set(cert.contractId, (certifiedByContract.get(cert.contractId) ?? 0) + num(cert.netAmount));
  }

  const contractRows = contracts.map((c) => ({
    code: c.code,
    contractor: contractorName(c.contractorId),
    status: c.status,
    value: num(c.contractValue),
    certified: certifiedByContract.get(c.id) ?? 0,
  }));
  const totalContractValue = contractRows.reduce((s, r) => s + r.value, 0);
  const totalCertified = contractRows.reduce((s, r) => s + r.certified, 0);

  const totalGross = certs.reduce((s, r) => s + num(r.grossAmount), 0);
  const totalNet = certs.reduce((s, r) => s + num(r.netAmount), 0);

  const totalRetained = retentions.reduce((s, r) => s + num(r.retainedAmount), 0);
  const totalReleased = retentions.reduce((s, r) => s + num(r.releasedAmount), 0);

  const totalAdvance = advances.reduce((s, r) => s + num(r.amount), 0);
  const totalRecovered = advances.reduce((s, r) => s + num(r.recoveredAmount), 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("con.reports")}</h2>
        <p className="text-muted-foreground">{t("con.reports_subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("con.report_contract_financials")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("con.contract")}</TableHead>
                <TableHead>{t("con.contractor")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">{t("con.total_contract_value")}</TableHead>
                <TableHead className="text-right">{t("con.certified")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractRows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">{t("con.no_data")}</TableCell></TableRow>
              ) : (
                contractRows.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{r.contractor}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                    <TableCell className="text-right">{fmt(r.value)}</TableCell>
                    <TableCell className="text-right">{fmt(r.certified)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {contractRows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>{t("con.total")}</TableCell>
                  <TableCell className="text-right">{fmt(totalContractValue)}</TableCell>
                  <TableCell className="text-right">{fmt(totalCertified)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("con.report_certificates")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>{t("con.count")}</TableCell>
                  <TableCell className="text-right">{certs.length}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("con.gross")}</TableCell>
                  <TableCell className="text-right">{fmt(totalGross)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("con.net")}</TableCell>
                  <TableCell className="text-right">{fmt(totalNet)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("con.report_retention")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>{t("con.count")}</TableCell>
                  <TableCell className="text-right">{retentions.length}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("con.retained")}</TableCell>
                  <TableCell className="text-right">{fmt(totalRetained)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("con.released")}</TableCell>
                  <TableCell className="text-right">{fmt(totalReleased)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("con.report_advances")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>{t("con.count")}</TableCell>
                  <TableCell className="text-right">{advances.length}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("con.total")}</TableCell>
                  <TableCell className="text-right">{fmt(totalAdvance)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("con.recovered")}</TableCell>
                  <TableCell className="text-right">{fmt(totalRecovered)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
