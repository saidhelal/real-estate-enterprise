import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDocuments,
  getListDocumentsQueryKey,
  useCreateDocument,
  useSubmitDocument,
  useArchiveDocument,
  useRestoreDocument,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { useToast } from "@/hooks/use-toast";

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

interface NewDoc {
  name: string;
  nameAr: string;
  documentType: string;
  classification: string;
  description: string;
  moduleKey: string;
  sourceId: string;
  creationDate: string;
  expiryDate: string;
  tags: string;
}

const EMPTY_DOC: NewDoc = {
  name: "",
  nameAr: "",
  documentType: "other",
  classification: "internal",
  description: "",
  moduleKey: "",
  sourceId: "",
  creationDate: "",
  expiryDate: "",
  tags: "",
};

export default function DocumentsPage() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [docType, setDocType] = useState(ALL);
  const [classification, setClassification] = useState(ALL);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<NewDoc>(EMPTY_DOC);

  const statusOptions = useMemo(() => enumOptions(STATUSES), []);
  const typeOptions = useMemo(() => enumOptions(TYPES), []);
  const classOptions = useMemo(() => enumOptions(CLASSIFICATIONS), []);

  const params = {
    companyId,
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    status: status === ALL ? undefined : status,
    documentType: docType === ALL ? undefined : docType,
    classification: classification === ALL ? undefined : classification,
    includeArchived: true,
  };
  const { data, isLoading } = useListDocuments(params, {
    query: { enabled: !!companyId, queryKey: getListDocumentsQueryKey(params) },
  });

  const createMutation = useCreateDocument();
  const submitMutation = useSubmitDocument();
  const archiveMutation = useArchiveDocument();
  const restoreMutation = useRestoreDocument();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runAction = (mutation: any, id: string) => {
    mutation.mutate(
      { id, data: {} },
      {
        onSuccess: () => {
          toast({ title: t("common.saved") });
          invalidate();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  const submitCreate = () => {
    if (!companyId || !form.name.trim()) return;
    createMutation.mutate(
      {
        data: {
          companyId,
          name: form.name.trim(),
          nameAr: form.nameAr || undefined,
          documentType: form.documentType,
          classification: form.classification,
          description: form.description || undefined,
          moduleKey: form.moduleKey || undefined,
          sourceId: form.sourceId || undefined,
          creationDate: form.creationDate || undefined,
          expiryDate: form.expiryDate || undefined,
          tags: form.tags
            ? form.tags.split(",").map((x) => x.trim()).filter(Boolean)
            : undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: t("common.saved") });
          setCreateOpen(false);
          setForm(EMPTY_DOC);
          invalidate();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  const rows: Document[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const set = (patch: Partial<NewDoc>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("edms.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("edms.subtitle")}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>{t("common.create")}</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("common.create")}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>{t("edms.name")}</Label>
                <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("edms.name_ar")}</Label>
                <Input
                  dir="rtl"
                  value={form.nameAr}
                  onChange={(e) => set({ nameAr: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>{t("edms.type")}</Label>
                  <Select value={form.documentType} onValueChange={(v) => set({ documentType: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {language === "ar" ? o.labelAr : o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("edms.classification")}</Label>
                  <Select
                    value={form.classification}
                    onValueChange={(v) => set({ classification: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {classOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {language === "ar" ? o.labelAr : o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("edms.description")}</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>{t("edms.module")}</Label>
                  <Input value={form.moduleKey} onChange={(e) => set({ moduleKey: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("edms.source_id")}</Label>
                  <Input value={form.sourceId} onChange={(e) => set({ sourceId: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>{t("edms.document_date")}</Label>
                  <Input
                    type="date"
                    value={form.creationDate}
                    onChange={(e) => set({ creationDate: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("edms.expiry_date")}</Label>
                  <Input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => set({ expiryDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("edms.tags")}</Label>
                <Input value={form.tags} onChange={(e) => set({ tags: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={createMutation.isPending || !form.name.trim()}
                onClick={submitCreate}
              >
                {t("common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="grid min-w-[200px] flex-1 gap-1.5">
            <Label>{t("common.search")}</Label>
            <Input
              placeholder={t("edms.search_placeholder")}
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("edms.filter_status")}</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setPage(1);
                setStatus(v);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("edms.all")}</SelectItem>
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {language === "ar" ? o.labelAr : o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("edms.filter_type")}</Label>
            <Select
              value={docType}
              onValueChange={(v) => {
                setPage(1);
                setDocType(v);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("edms.all")}</SelectItem>
                {typeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {language === "ar" ? o.labelAr : o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("edms.filter_classification")}</Label>
            <Select
              value={classification}
              onValueChange={(v) => {
                setPage(1);
                setClassification(v);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("edms.all")}</SelectItem>
                {classOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {language === "ar" ? o.labelAr : o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/documents/${d.id}`}>{t("common.view")}</Link>
                        </Button>
                        {d.status === "draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={submitMutation.isPending}
                            onClick={() => runAction(submitMutation, d.id)}
                          >
                            {t("edms.submit")}
                          </Button>
                        )}
                        {d.status === "archived" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={restoreMutation.isPending}
                            onClick={() => runAction(restoreMutation, d.id)}
                          >
                            {t("edms.restore")}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={archiveMutation.isPending}
                            onClick={() => runAction(archiveMutation, d.id)}
                          >
                            {t("edms.archive")}
                          </Button>
                        )}
                      </div>
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
