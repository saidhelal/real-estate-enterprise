import { Link, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCrmCustomerProfile,
  getGetCrmCustomerProfileQueryKey,
  useUpdateCustomer,
  useCreateCustomerNote,
  useCreateCustomerDocument,
  useCreateCustomerContact,
  useCreateLeadActivity,
  useCreateLeadFollowUp,
  useListUsers,
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
import { useToast } from "@/hooks/use-toast";
import { enumLabel, enumOptions, CRM_CLASSIFICATIONS } from "@/lib/enums";
import { ActionDialog, ReservationDialog, type DialogField } from "@/components/crm/crm-dialogs";

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

const today = () => new Date().toISOString().slice(0, 10);

export default function CrmCustomerProfilePage() {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, params] = useRoute("/crm/customers/:id");
  const id = params?.id ?? "";

  const { data: users } = useListUsers();
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.fullName }));

  const queryKey = getGetCrmCustomerProfileQueryKey(id);
  const { data, isLoading } = useGetCrmCustomerProfile(id, {
    query: { enabled: !!id, queryKey },
  });

  const updateCustomer = useUpdateCustomer();
  const createNote = useCreateCustomerNote();
  const createDocument = useCreateCustomerDocument();
  const createContact = useCreateCustomerContact();
  const createActivity = useCreateLeadActivity();
  const createFollowUp = useCreateLeadFollowUp();

  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const onError = () => toast({ title: t("common.error"), variant: "destructive" });
  const onCreated = (close: () => void) => {
    toast({ title: t("common.created") });
    invalidate();
    close();
  };

  if (isLoading) return <p className="text-muted-foreground">{t("common.loading")}</p>;
  if (!data) return <p className="text-muted-foreground">{t("common.no_data")}</p>;

  const c = data.customer;
  const companyId = c.companyId;
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
      .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${v}</td></tr>`)
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

  const customerFields: DialogField[] = [
    { name: "fullName", label: t("crm.field.full_name"), required: true, defaultValue: c.fullName },
    { name: "nameAr", label: t("crm.field.name_ar"), rtl: true, defaultValue: c.nameAr ?? "" },
    { name: "phone", label: t("crm.phone"), defaultValue: c.phone ?? "" },
    { name: "email", label: t("crm.email"), defaultValue: c.email ?? "" },
    { name: "address", label: t("crm.address"), type: "textarea", defaultValue: c.address ?? "" },
    {
      name: "classification",
      label: t("crm.classification"),
      type: "select",
      options: enumOptions([...CRM_CLASSIFICATIONS]),
      defaultValue: c.classification ?? "",
    },
    {
      name: "assignedToUserId",
      label: t("crm.assigned_rep"),
      type: "select",
      options: userOptions,
      defaultValue: c.assignedToUserId ?? "",
    },
  ];

  const activityFields: DialogField[] = [
    {
      name: "activityType",
      label: t("crm.activity.type"),
      type: "select",
      required: true,
      options: enumOptions(["call", "visit", "meeting", "note", "email"]),
      defaultValue: "call",
    },
    { name: "subject", label: t("crm.activity.subject"), defaultValue: "" },
    { name: "activityDate", label: t("crm.activity.date"), type: "date", required: true, defaultValue: today() },
    { name: "notes", label: t("crm.activity.notes"), type: "textarea" },
  ];

  const followUpFields: DialogField[] = [
    { name: "dueDate", label: t("crm.followup.due"), type: "date", required: true, defaultValue: today() },
    {
      name: "status",
      label: t("common.status"),
      type: "select",
      options: enumOptions(["pending", "done", "cancelled"]),
      defaultValue: "pending",
    },
    { name: "notes", label: t("crm.followup.notes"), type: "textarea", required: true },
  ];

  const noteFields: DialogField[] = [
    { name: "note", label: t("crm.note.body"), type: "textarea", required: true },
  ];

  const documentFields: DialogField[] = [
    { name: "docType", label: t("crm.document.type"), required: true },
    { name: "docNumber", label: t("crm.document.number") },
    { name: "fileName", label: t("crm.document.file") },
    { name: "issueDate", label: t("crm.document.issue"), type: "date" },
    { name: "expiryDate", label: t("crm.document.expiry"), type: "date" },
    { name: "notes", label: t("crm.activity.notes"), type: "textarea" },
  ];

  const contactFields: DialogField[] = [
    { name: "name", label: t("crm.contact.name"), required: true },
    { name: "relation", label: t("crm.contact.relation") },
    { name: "phone", label: t("crm.phone") },
    { name: "email", label: t("crm.email") },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{name}</h2>
          <p className="text-muted-foreground">
            {c.code} · {enumLabel(c.type, language)}
            {data.assignedToName ? ` · ${t("crm.assigned_rep")}: ${data.assignedToName}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {c.classification ? (
            <Badge variant="outline">{enumLabel(c.classification, language)}</Badge>
          ) : null}
          <ActionDialog
            title={t("crm.action.edit_customer")}
            submitLabel={t("common.save")}
            trigger={<Button variant="outline" size="sm">{t("crm.action.edit_customer")}</Button>}
            fields={customerFields}
            isPending={updateCustomer.isPending}
            onSubmit={(values, close) =>
              updateCustomer.mutate(
                { id, data: values },
                {
                  onSuccess: () => {
                    toast({ title: t("common.saved") });
                    invalidate();
                    close();
                  },
                  onError,
                },
              )
            }
          />
          <ReservationDialog
            companyId={companyId}
            fixedCustomer={{ id, label: name }}
            onCreated={invalidate}
            trigger={<Button size="sm">{t("crm.action.new_reservation")}</Button>}
          />
        </div>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("crm.activities")}</CardTitle>
          <ActionDialog
            title={t("crm.action.log_activity")}
            trigger={<Button variant="outline" size="sm">{t("crm.action.log_activity")}</Button>}
            fields={activityFields}
            isPending={createActivity.isPending}
            onSubmit={(values, close) =>
              createActivity.mutate(
                {
                  data: {
                    companyId: companyId ?? "",
                    customerId: id,
                    activityType: values.activityType,
                    activityDate: values.activityDate,
                    subject: values.subject,
                    notes: values.notes,
                  },
                },
                { onSuccess: () => onCreated(close), onError },
              )
            }
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("crm.activity.type")}</TableHead>
                <TableHead>{t("crm.activity.subject")}</TableHead>
                <TableHead>{t("crm.activity.notes")}</TableHead>
                <TableHead className="text-end">{t("crm.activity.date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.activities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-16 text-muted-foreground">{t("common.no_data")}</TableCell>
                </TableRow>
              ) : (
                data.activities.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell><Badge variant="secondary">{enumLabel(a.activityType, language)}</Badge></TableCell>
                    <TableCell>{a.subject ?? "-"}</TableCell>
                    <TableCell>{a.notes ?? "-"}</TableCell>
                    <TableCell className="text-end">{a.activityDate?.slice(0, 10)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("crm.followups")}</CardTitle>
          <ActionDialog
            title={t("crm.action.new_followup")}
            trigger={<Button variant="outline" size="sm">{t("crm.action.new_followup")}</Button>}
            fields={followUpFields}
            isPending={createFollowUp.isPending}
            onSubmit={(values, close) =>
              createFollowUp.mutate(
                {
                  data: {
                    companyId: companyId ?? "",
                    customerId: id,
                    dueDate: values.dueDate,
                    status: values.status,
                    notes: values.notes,
                  },
                },
                { onSuccess: () => onCreated(close), onError },
              )
            }
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("crm.followup.due")}</TableHead>
                <TableHead>{t("crm.followup.notes")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.followUps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-16 text-muted-foreground">{t("common.no_data")}</TableCell>
                </TableRow>
              ) : (
                data.followUps.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.dueDate?.slice(0, 10)}</TableCell>
                    <TableCell>{f.notes ?? "-"}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(f.status, language)}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("crm.stat.reservations")}</CardTitle>
          <ReservationDialog
            companyId={companyId}
            fixedCustomer={{ id, label: name }}
            onCreated={invalidate}
            trigger={<Button variant="outline" size="sm">{t("crm.action.new_reservation")}</Button>}
          />
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
                  <TableCell colSpan={6} className="text-center h-16 text-muted-foreground">{t("common.no_data")}</TableCell>
                </TableRow>
              ) : (
                data.reservations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{r.unitCode ?? "-"}</TableCell>
                    <TableCell>{r.reservationDate?.slice(0, 10)}</TableCell>
                    <TableCell className="text-end">{r.amount}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
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
                  <TableCell colSpan={6} className="text-center h-16 text-muted-foreground">{t("common.no_data")}</TableCell>
                </TableRow>
              ) : (
                data.contracts.map((ct) => (
                  <TableRow key={ct.id}>
                    <TableCell className="font-medium">{ct.code}</TableCell>
                    <TableCell>{ct.unitCode ?? "-"}</TableCell>
                    <TableCell>{ct.contractDate?.slice(0, 10)}</TableCell>
                    <TableCell className="text-end">{ct.totalPrice}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(ct.status, language)}</Badge></TableCell>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("crm.communication_history")}</CardTitle>
          <ActionDialog
            title={t("crm.action.new_note")}
            trigger={<Button variant="outline" size="sm">{t("crm.action.new_note")}</Button>}
            fields={noteFields}
            isPending={createNote.isPending}
            onSubmit={(values, close) =>
              createNote.mutate(
                { data: { companyId: companyId ?? "", customerId: id, note: values.note } },
                { onSuccess: () => onCreated(close), onError },
              )
            }
          />
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
                  <TableCell colSpan={2} className="text-center h-16 text-muted-foreground">{t("common.no_data")}</TableCell>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("crm.documents")}</CardTitle>
          <ActionDialog
            title={t("crm.action.new_document")}
            trigger={<Button variant="outline" size="sm">{t("crm.action.new_document")}</Button>}
            fields={documentFields}
            isPending={createDocument.isPending}
            onSubmit={(values, close) =>
              createDocument.mutate(
                { data: { companyId: companyId ?? "", customerId: id, ...values, docType: values.docType } },
                { onSuccess: () => onCreated(close), onError },
              )
            }
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("crm.document.type")}</TableHead>
                <TableHead>{t("crm.document.number")}</TableHead>
                <TableHead>{t("crm.document.file")}</TableHead>
                <TableHead className="text-end">{t("crm.document.expiry")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-16 text-muted-foreground">{t("common.no_data")}</TableCell>
                </TableRow>
              ) : (
                data.documents.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.docType}</TableCell>
                    <TableCell>{d.docNumber ?? "-"}</TableCell>
                    <TableCell>{d.fileName ?? "-"}</TableCell>
                    <TableCell className="text-end">{d.expiryDate ?? "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("crm.contacts")}</CardTitle>
          <ActionDialog
            title={t("crm.action.new_contact")}
            trigger={<Button variant="outline" size="sm">{t("crm.action.new_contact")}</Button>}
            fields={contactFields}
            isPending={createContact.isPending}
            onSubmit={(values, close) =>
              createContact.mutate(
                { data: { companyId: companyId ?? "", customerId: id, ...values, name: values.name } },
                { onSuccess: () => onCreated(close), onError },
              )
            }
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("crm.contact.name")}</TableHead>
                <TableHead>{t("crm.contact.relation")}</TableHead>
                <TableHead>{t("crm.phone")}</TableHead>
                <TableHead>{t("crm.email")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-16 text-muted-foreground">{t("common.no_data")}</TableCell>
                </TableRow>
              ) : (
                data.contacts.map((ct) => (
                  <TableRow key={ct.id}>
                    <TableCell className="font-medium">{ct.name}</TableCell>
                    <TableCell>{ct.relation ?? "-"}</TableCell>
                    <TableCell>{ct.phone ?? "-"}</TableCell>
                    <TableCell>{ct.email ?? "-"}</TableCell>
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
