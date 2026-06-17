import { Link, useRoute } from "wouter";
import {
  useGetCrmCustomerProfile,
  getGetCrmCustomerProfileQueryKey,
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

function esc(v: string | null | undefined): string {
  return String(v ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

export default function CrmCustomerProfilePage() {
  const { language, t } = useLanguage();
  const [, params] = useRoute("/crm/customers/:id");
  const id = params?.id ?? "";

  const { data, isLoading } = useGetCrmCustomerProfile(id, {
    query: { enabled: !!id, queryKey: getGetCrmCustomerProfileQueryKey(id) },
  });

  if (isLoading) return <p className="text-muted-foreground">{t("common.loading")}</p>;
  if (!data) return <p className="text-muted-foreground">{t("common.no_data")}</p>;

  const c = data.customer;
  const name = language === "ar" ? c.nameAr ?? c.fullName : c.fullName;
  const dir = language === "ar" ? "rtl" : "ltr";

  const printReservation = (r: (typeof data.reservations)[number]): void => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    const rows: Array<[string, string]> = [
      [t("crm.reservation.code"), esc(r.code)],
      [t("crm.unit.code"), esc(r.unitCode)],
      [t("crm.customer"), esc(name)],
      [t("crm.reservation.date"), esc(r.reservationDate?.slice(0, 10))],
      [t("crm.reservation.expiry"), esc(r.expiryDate?.slice(0, 10))],
      [t("common.amount"), esc(r.amount)],
      [t("common.status"), esc(enumLabel(r.status, language))],
    ];
    const body = rows
      .map(
        ([k, v]) =>
          `<tr><td class="k">${esc(k)}</td><td class="v">${v}</td></tr>`,
      )
      .join("");
    w.document.write(`<!DOCTYPE html><html dir="${dir}" lang="${language}"><head><meta charset="utf-8">
      <title>${esc(r.code)}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:40px;color:#111}
        h1{font-size:20px;margin-bottom:24px}
        table{width:100%;border-collapse:collapse}
        td{border:1px solid #ccc;padding:10px;font-size:14px}
        td.k{background:#f5f5f5;font-weight:bold;width:40%}
      </style></head><body>
      <h1>${esc(t("crm.reservation.form_title"))}</h1>
      <table>${body}</table>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{name}</h2>
          <p className="text-muted-foreground">
            {c.code} · {enumLabel(c.type, language)}
            {data.assignedToName ? ` · ${t("crm.assigned_rep")}: ${data.assignedToName}` : ""}
          </p>
        </div>
        {c.classification ? (
          <Badge variant="outline">{enumLabel(c.classification, language)}</Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Stat label={t("crm.stat.reservations")} value={data.stats.reservations} />
        <Stat label={t("crm.stat.contracts")} value={data.stats.contracts} />
        <Stat label={t("crm.contract_value")} value={data.stats.totalContractValue} />
        <Stat label={t("crm.paid")} value={data.stats.paidAmount} />
        <Stat label={t("crm.due")} value={data.stats.dueAmount} />
        <Stat label={t("crm.overdue")} value={data.stats.overdueAmount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("crm.contact_info")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <div><span className="text-muted-foreground">{t("crm.phone")}: </span>{c.phone ?? "-"}</div>
          <div><span className="text-muted-foreground">{t("crm.email")}: </span>{c.email ?? "-"}</div>
          <div><span className="text-muted-foreground">{t("crm.address")}: </span>{c.address ?? "-"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("crm.stat.reservations")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("crm.reservation.code")}</TableHead>
                <TableHead>{t("crm.unit.code")}</TableHead>
                <TableHead>{t("crm.reservation.date")}</TableHead>
                <TableHead className="text-end">{t("common.amount")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.reservations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-16 text-muted-foreground">
                    {t("common.no_data")}
                  </TableCell>
                </TableRow>
              ) : (
                data.reservations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{r.unitCode ?? "-"}</TableCell>
                    <TableCell>{r.reservationDate?.slice(0, 10)}</TableCell>
                    <TableCell className="text-end">{r.amount}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{enumLabel(r.status, language)}</Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <Button variant="outline" size="sm" onClick={() => printReservation(r)}>
                        {t("crm.reservation.print")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("crm.stat.contracts")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("crm.contract.code")}</TableHead>
                <TableHead>{t("crm.unit.code")}</TableHead>
                <TableHead>{t("crm.contract.date")}</TableHead>
                <TableHead className="text-end">{t("crm.contract.total")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-16 text-muted-foreground">
                    {t("common.no_data")}
                  </TableCell>
                </TableRow>
              ) : (
                data.contracts.map((ct) => (
                  <TableRow key={ct.id}>
                    <TableCell className="font-medium">{ct.code}</TableCell>
                    <TableCell>{ct.unitCode ?? "-"}</TableCell>
                    <TableCell>{ct.contractDate?.slice(0, 10)}</TableCell>
                    <TableCell className="text-end">{ct.totalPrice}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{enumLabel(ct.status, language)}</Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <Link href="/contracts" className="text-primary hover:underline text-sm">
                        {t("crm.contract.open")}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("crm.communication_history")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("crm.note.body")}</TableHead>
                <TableHead className="text-end">{t("common.date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.notes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center h-16 text-muted-foreground">
                    {t("common.no_data")}
                  </TableCell>
                </TableRow>
              ) : (
                data.notes.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>{n.note}</TableCell>
                    <TableCell className="text-end">{n.createdAt?.slice(0, 10)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
