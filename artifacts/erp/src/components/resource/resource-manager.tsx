import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setNextChangeReason } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

export type FieldType = "text" | "textarea" | "number" | "money" | "date" | "select" | "boolean";

export interface SelectOption {
  value: string;
  label: string;
  labelAr?: string;
}

export interface ResourceField {
  name: string;
  label: string;
  labelAr?: string;
  type?: FieldType;
  required?: boolean;
  rtl?: boolean;
  /** Disabled when editing (e.g. immutable code). */
  createOnly?: boolean;
  /** For select fields. */
  options?: SelectOption[];
}

export interface ResourceColumn<T> {
  header: string;
  headerAr?: string;
  render: (row: T) => React.ReactNode;
}

interface MutationLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutate: (vars: any, opts?: any) => void;
  isPending: boolean;
}

interface ListLike<T> {
  data?: { data: T[]; total: number };
  isLoading: boolean;
}

export interface ResourceManagerProps<T extends { id: string }> {
  title: string;
  titleAr?: string;
  columns: ResourceColumn<T>[];
  fields: ResourceField[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useList: (params?: any) => ListLike<T>;
  useCreate: () => MutationLike;
  useUpdate: () => MutationLike;
  useDelete: () => MutationLike;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getListQueryKey: (params?: any) => readonly unknown[];
  /** Default companyId to inject into create payloads. */
  companyId?: string;
  searchable?: boolean;
  /** Hide the create action (e.g. system-generated records). Defaults to true. */
  canCreate?: boolean;
  /** Show the edit action. Boolean or per-row predicate. Defaults to true. */
  canEdit?: boolean | ((row: T) => boolean);
  /** Show the delete action. Boolean or per-row predicate. Defaults to true. */
  canDelete?: boolean | ((row: T) => boolean);
  /** Extra per-row action buttons rendered before edit/delete. */
  rowActions?: (row: T) => React.ReactNode;
  pageSize?: number;
}

const NONE = "__none__";

/** Server governance middleware answers a governed mutation with 202 + this shape. */
function isPendingApproval(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as { pendingApproval?: unknown }).pendingApproval === true
  );
}

export function ResourceManager<T extends { id: string }>(props: ResourceManagerProps<T>) {
  const {
    title,
    titleAr,
    columns,
    fields,
    useList,
    useCreate,
    useUpdate,
    useDelete,
    getListQueryKey,
    companyId,
    searchable = true,
    canCreate = true,
    canEdit = true,
    canDelete = true,
    rowActions,
    pageSize = 10,
  } = props;

  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const params: Record<string, unknown> = { page, pageSize };
  if (search) params.search = search;

  const { data, isLoading } = useList(params);
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const deleteMutation = useDelete();

  const heading = language === "ar" && titleAr ? titleAr : title;
  const colHeader = (c: ResourceColumn<T>) =>
    language === "ar" && c.headerAr ? c.headerAr : c.header;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListQueryKey() });

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const reason = deleteReason.trim();
    if (!reason) return;
    setNextChangeReason(reason, heading);
    deleteMutation.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: (result: unknown) => {
          if (isPendingApproval(result)) {
            toast({ title: t("governance.submitted") });
          } else {
            toast({ title: t("common.deleted") });
          }
          setDeleteTarget(null);
          setDeleteReason("");
          invalidate();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
        <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
        {canCreate && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t("common.create")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("common.create")}</DialogTitle>
              </DialogHeader>
              <ResourceForm
                fields={fields}
                companyId={companyId}
                useCreate={useCreate}
                useUpdate={useUpdate}
                onSuccess={() => {
                  setIsCreateOpen(false);
                  invalidate();
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {searchable && (
        <Input
          placeholder={t("common.search")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
      )}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c, i) => (
                <TableHead key={i}>{colHeader(c)}</TableHead>
              ))}
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center h-24">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center h-24">
                  {t("common.no_results")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((c, i) => (
                    <TableCell key={i}>{c.render(row)}</TableCell>
                  ))}
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    {rowActions?.(row)}
                    {(typeof canEdit === "function" ? canEdit(row) : canEdit) && (
                      <Button variant="ghost" size="icon" onClick={() => setEditing(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {(typeof canDelete === "function" ? canDelete(row) : canDelete) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => {
                          setDeleteReason("");
                          setDeleteTarget(row);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("common.total")}: {total}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.delete")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("governance.delete_hint")}</p>
            <div className="space-y-2">
              <Label>{t("governance.reason")}</Label>
              <Textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder={t("governance.reason_placeholder")}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteReason("");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending || !deleteReason.trim()}
                onClick={confirmDelete}
              >
                {t("common.delete")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("common.edit")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <ResourceForm
              fields={fields}
              companyId={companyId}
              record={editing}
              useCreate={useCreate}
              useUpdate={useUpdate}
              onSuccess={() => {
                setEditing(null);
                invalidate();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResourceForm<T extends { id: string }>({
  fields,
  record,
  companyId,
  useCreate,
  useUpdate,
  onSuccess,
}: {
  fields: ResourceField[];
  record?: T;
  companyId?: string;
  useCreate: () => MutationLike;
  useUpdate: () => MutationLike;
  onSuccess: () => void;
}) {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const isEdit = !!record;

  const initial: Record<string, string> = {};
  for (const f of fields) {
    const v = record ? (record as Record<string, unknown>)[f.name] : undefined;
    initial[f.name] = v === null || v === undefined ? "" : String(v);
  }
  const [formData, setFormData] = useState<Record<string, string>>(initial);

  const fieldLabel = (f: ResourceField) =>
    language === "ar" && f.labelAr ? f.labelAr : f.label;

  const buildPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      if (isEdit && f.createOnly) continue;
      const raw = formData[f.name];
      if (raw === undefined || raw === "" || raw === NONE) continue;
      if (f.type === "number") payload[f.name] = Number(raw);
      else if (f.type === "money") payload[f.name] = String(raw);
      else if (f.type === "boolean") payload[f.name] = raw === "true";
      else payload[f.name] = raw;
    }
    return payload;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!isEdit && companyId && !payload.companyId) payload.companyId = companyId;

    if (isEdit && record) {
      updateMutation.mutate(
        { id: record.id, data: payload },
        {
          onSuccess: (result: unknown) => {
            toast({
              title: isPendingApproval(result) ? t("governance.submitted") : t("common.saved"),
            });
            onSuccess();
          },
          onError: () => toast({ title: t("common.error"), variant: "destructive" }),
        },
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: (result: unknown) => {
            toast({
              title: isPendingApproval(result) ? t("governance.submitted") : t("common.created"),
            });
            onSuccess();
          },
          onError: () => toast({ title: t("common.error"), variant: "destructive" }),
        },
      );
    }
  };

  const setValue = (name: string, value: string) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields
        .filter((f) => f.name !== "companyId")
        .map((f) => {
          const disabled = isEdit && f.createOnly;
          return (
            <div key={f.name} className="space-y-2">
              <Label>
                {fieldLabel(f)}
                {f.required && <span className="text-destructive"> *</span>}
              </Label>
              {f.type === "textarea" ? (
                <Textarea
                  value={formData[f.name] ?? ""}
                  onChange={(e) => setValue(f.name, e.target.value)}
                  required={f.required}
                  dir={f.rtl ? "rtl" : undefined}
                />
              ) : f.type === "boolean" ? (
                <Select
                  value={formData[f.name] || "false"}
                  onValueChange={(v) => setValue(f.name, v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={fieldLabel(f)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">{language === "ar" ? "نعم" : "Yes"}</SelectItem>
                    <SelectItem value="false">{language === "ar" ? "لا" : "No"}</SelectItem>
                  </SelectContent>
                </Select>
              ) : f.type === "select" ? (
                <Select
                  value={formData[f.name] || (f.required ? "" : NONE)}
                  onValueChange={(v) => setValue(f.name, v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={fieldLabel(f)} />
                  </SelectTrigger>
                  <SelectContent>
                    {!f.required && <SelectItem value={NONE}>—</SelectItem>}
                    {(f.options ?? []).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {language === "ar" && o.labelAr ? o.labelAr : o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={
                    f.type === "number" || f.type === "money"
                      ? "number"
                      : f.type === "date"
                        ? "date"
                        : "text"
                  }
                  step={f.type === "money" ? "0.01" : undefined}
                  value={formData[f.name] ?? ""}
                  onChange={(e) => setValue(f.name, e.target.value)}
                  required={f.required}
                  disabled={disabled}
                  dir={f.rtl ? "rtl" : undefined}
                />
              )}
            </div>
          );
        })}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {isEdit ? t("common.save") : t("common.create")}
        </Button>
      </div>
    </form>
  );
}
