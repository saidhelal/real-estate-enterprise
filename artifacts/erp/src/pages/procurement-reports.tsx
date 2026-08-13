import { useQuery } from "@tanstack/react-query";
import {
  useListCompanies,
  listSuppliers,
  listPurchaseOrders,
  listPurchaseContracts,
  listGoodsReceiptNotes,
  listPurchaseReturns,
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
import { TableState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
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

export default function ProcurementReportsPage() {
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

  const { data: suppliers = [] } = useQuery({
    queryKey: ["proc-report", "suppliers", companyId],
    queryFn: () => fetchAll((p) => listSuppliers(p)),
    enabled,
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["proc-report", "orders", companyId],
    queryFn: () => fetchAll((p) => listPurchaseOrders(p)),
    enabled,
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["proc-report", "contracts", companyId],
    queryFn: () => fetchAll((p) => listPurchaseContracts(p)),
    enabled,
  });
  const { data: grns = [] } = useQuery({
    queryKey: ["proc-report", "grns", companyId],
    queryFn: () => fetchAll((p) => listGoodsReceiptNotes(p)),
    enabled,
  });
  const { data: returns = [] } = useQuery({
    queryKey: ["proc-report", "returns", companyId],
    queryFn: () => fetchAll((p) => listPurchaseReturns(p)),
    enabled,
  });

  const supplierName = (id: string | null | undefined) => {
    const s = suppliers.find((x) => x.id === id);
    if (!s) return "-";
    return (language === "ar" ? s.nameAr : s.name) ?? s.name ?? "-";
  };

  // Purchase volume by supplier
  const volumeBySupplier = new Map<string, number>();
  for (const po of orders) {
    if (!po.supplierId) continue;
    volumeBySupplier.set(po.supplierId, (volumeBySupplier.get(po.supplierId) ?? 0) + num(po.totalAmount));
  }
  const supplierRows = suppliers.map((s) => ({
    code: s.code,
    name: (language === "ar" ? s.nameAr : s.name) ?? s.name,
    status: s.status,
    volume: volumeBySupplier.get(s.id) ?? 0,
  }));
  const totalVolume = supplierRows.reduce((acc, r) => acc + r.volume, 0);

  const totalOrders = orders.reduce((acc, r) => acc + num(r.totalAmount), 0);
  const totalContractValue = contracts.reduce((acc, r) => acc + num(r.contractValue), 0);
  const totalReceived = grns.reduce((acc, r) => acc + num(r.totalAmount), 0);
  const totalReturned = returns.reduce((acc, r) => acc + num(r.totalAmount), 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("proc.reports")}
        description={t("proc.reports_subtitle")}
        bordered={false}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("proc.report_supplier_volume")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.code")}</TableHead>
                <TableHead>{t("proc.supplier")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-end">{t("proc.purchase_volume")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplierRows.length === 0 ? (
                <TableState colSpan={4} isEmpty emptyTitle={t("proc.no_data")} />
              ) : (
                supplierRows.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                    <TableCell className="text-end">{fmt(r.volume)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {supplierRows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>{t("proc.total")}</TableCell>
                  <TableCell className="text-end">{fmt(totalVolume)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("proc.report_orders")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>{t("proc.count")}</TableCell>
                  <TableCell className="text-end">{orders.length}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("proc.total")}</TableCell>
                  <TableCell className="text-end">{fmt(totalOrders)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("proc.total_contract_value")}</TableCell>
                  <TableCell className="text-end">{fmt(totalContractValue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("proc.report_receipts")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>{t("proc.count")}</TableCell>
                  <TableCell className="text-end">{grns.length}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("proc.total")}</TableCell>
                  <TableCell className="text-end">{fmt(totalReceived)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("proc.report_returns")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>{t("proc.count")}</TableCell>
                  <TableCell className="text-end">{returns.length}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("proc.total")}</TableCell>
                  <TableCell className="text-end">{fmt(totalReturned)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
