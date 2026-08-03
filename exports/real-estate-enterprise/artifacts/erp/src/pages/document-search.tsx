import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useListDocuments,
  getListDocumentsQueryKey,
  useListCompanies,
  useListCustomers,
  useListProjects,
  useListUnits,
  useListDepartments,
  useListBranches,
  useListUsers,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";

const STATUSES = ["draft", "review", "approved", "active", "archived", "expired"];
const TYPES = [
  "contract",
  "invoice",
  "receipt",
  "deed",
  "report",
  "correspondence",
  "license",
  "identity",
  "other",
];
const CLASSIFICATIONS = ["public", "internal", "confidential", "restricted"];

const ALL = "__all__";
const PAGE_SIZE = 20;

interface Filters {
  search: string;
  moduleKey: string;
  status: string;
  documentType: string;
  classification: string;
  customerId: string;
  projectId: string;
  unitId: string;
  departmentId: string;
  branchId: string;
  ownerUserId: string;
  fileFormat: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY: Filters = {
  search: "",
  moduleKey: "",
  status: ALL,
  documentType: ALL,
  classification: ALL,
  customerId: ALL,
  projectId: ALL,
  unitId: ALL,
  departmentId: ALL,
  branchId: ALL,
  ownerUserId: ALL,
  fileFormat: "",
  dateFrom: "",
  dateTo: "",
};

export default function DocumentSearchPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const { data: customers } = useListCustomers({ pageSize: 200 });
  const { data: projects } = useListProjects({ pageSize: 200 });
  const { data: units } = useListUnits({ pageSize: 200 });
  const { data: departments } = useListDepartments({ pageSize: 200 });
  const { data: branches } = useListBranches();
  const { data: users } = useListUsers();

  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);

  const statusOptions = useMemo(() => enumOptions(STATUSES), []);
  const typeOptions = useMemo(() => enumOptions(TYPES), []);
  const classOptions = useMemo(() => enumOptions(CLASSIFICATIONS), []);

  const customerOptions = (customers?.data ?? []).map((c) => ({ value: c.id, label: c.fullName }));
  const projectOptions = (projects?.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const unitOptions = (units?.data ?? []).map((u) => ({ value: u.id, label: u.name }));
  const departmentOptions = (departments?.data ?? []).map((d) => ({ value: d.id, label: d.name }));
  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.fullName }));

  const v = (x: string) => (x && x !== ALL ? x : undefined);
  const params = {
    companyId,
    page,
    pageSize: PAGE_SIZE,
    search: applied.search || undefined,
    moduleKey: applied.moduleKey || undefined,
    status: v(applied.status),
    documentType: v(applied.documentType),
    classification: v(applied.classification),
    customerId: v(applied.customerId),
    projectId: v(applied.projectId),
    unitId: v(applied.unitId),
    departmentId: v(applied.departmentId),
    branchId: v(applied.branchId),
    ownerUserId: v(applied.ownerUserId),
    fileFormat: applied.fileFormat || undefined,
    dateFrom: applied.dateFrom || undefined,
    dateTo: applied.dateTo || undefined,
    includeArchived: true,
  };
  const { data, isLoading } = useListDocuments(params, {
    query: { enabled: !!companyId, queryKey: getListDocumentsQueryKey(params) },
  });

  const rows: Document[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const set = (patch: Partial<Filters>) => setDraft((f) => ({ ...f, ...patch }));
  const apply = () => {
    setPage(1);
    setApplied(draft);
  };
  const clear = () => {
    setPage(1);
    setDraft(EMPTY);
    setApplied(EMPTY);
  };

  const renderSelect = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: { value: string; label: string }[],
  ) => (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("edms.all")}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const renderEnumSelect = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: { value: string; label: string; labelAr: string }[],
  ) => (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("edms.all")}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {language === "ar" ? o.labelAr : o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6 p-1">
      <div>
        <h1 className="text-2xl font-bold">{t("edms.advanced_search.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("edms.advanced_search.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("edms.advanced_search.filters")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label>{t("edms.advanced_search.keywords")}</Label>
            <Input
              placeholder={t("edms.search_placeholder")}
              value={draft.search}
              onChange={(e) => set({ search: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply();
              }}
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {renderEnumSelect(t("edms.filter_status"), draft.status, (x) => set({ status: x }), statusOptions)}
            {renderEnumSelect(t("edms.filter_type"), draft.documentType, (x) => set({ documentType: x }), typeOptions)}
            {renderEnumSelect(
              t("edms.filter_classification"),
              draft.classification,
              (x) => set({ classification: x }),
              classOptions,
            )}
            {renderSelect(t("edms.filter.customer"), draft.customerId, (x) => set({ customerId: x }), customerOptions)}
            {renderSelect(t("edms.filter.project"), draft.projectId, (x) => set({ projectId: x }), projectOptions)}
            {renderSelect(t("edms.filter.unit"), draft.unitId, (x) => set({ unitId: x }), unitOptions)}
            {renderSelect(
              t("edms.filter.department"),
              draft.departmentId,
              (x) => set({ departmentId: x }),
              departmentOptions,
            )}
            {renderSelect(t("edms.filter.branch"), draft.branchId, (x) => set({ branchId: x }), branchOptions)}
            {renderSelect(t("edms.filter.owner"), draft.ownerUserId, (x) => set({ ownerUserId: x }), userOptions)}
            <div className="grid gap-1.5">
              <Label>{t("edms.filter.screen")}</Label>
              <Input
                className="w-[160px]"
                placeholder="units"
                value={draft.moduleKey}
                onChange={(e) => set({ moduleKey: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") apply();
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("edms.filter.file_format")}</Label>
              <Input
                className="w-[120px]"
                placeholder="pdf"
                value={draft.fileFormat}
                onChange={(e) => set({ fileFormat: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("edms.filter.date_from")}</Label>
              <Input
                type="date"
                value={draft.dateFrom}
                onChange={(e) => set({ dateFrom: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("edms.filter.date_to")}</Label>
              <Input
                type="date"
                value={draft.dateTo}
                onChange={(e) => set({ dateTo: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={apply}>{t("edms.advanced_search.apply")}</Button>
            <Button variant="outline" onClick={clear}>
              {t("edms.advanced_search.clear")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("edms.document_number")}</TableHead>
                <TableHead>{t("edms.name")}</TableHead>
                <TableHead>{t("edms.type")}</TableHead>
                <TableHead>{t("edms.classification")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    …
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {t("edms.no_documents")}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      <Link href={`/documents/${d.id}`} className="text-primary hover:underline">
                        {d.documentNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{language === "ar" ? (d.nameAr ?? d.name) : d.name}</TableCell>
                    <TableCell>{enumLabel(d.documentType, language)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{enumLabel(d.classification, language)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{enumLabel(d.status, language)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/documents/${d.id}`}>{t("common.view")}</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{total}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("common.previous")}
              </Button>
              <span className="text-sm">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
