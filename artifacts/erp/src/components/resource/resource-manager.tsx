import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setNextChangeReason } from "@workspace/api-client-react";
import { DocumentsRowAction } from "@/components/documents/documents-row-action";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { NONE, resetDescendants, visibleOptions } from "./cascade";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Check,
} from "lucide-react";

/** Sentinel value for the "All" (cleared) state of a toolbar filter select. */
const ALL = "__all__";

export type FieldType = "text" | "textarea" | "number" | "money" | "date" | "select" | "boolean";

export interface SelectOption {
  value: string;
  label: string;
  labelAr?: string;
  /**
   * Parent record id this option belongs to. When the owning field declares
   * `dependsOn`, options are filtered to those whose `parentValue` matches the
   * current value of the parent field (cascading dropdowns).
   */
  parentValue?: string;
  /**
   * Per-parent ancestor ids for multi-parent narrowing. When the owning field
   * declares `dependsOn` as a list (e.g. a Building that must match both the
   * selected Project and the selected Phase), the option is kept only if, for
   * every parent field that currently has a value, the matching entry here
   * equals it. A `null`/`undefined` entry means "this option has no such
   * ancestor" (e.g. a building with no phase), so it is excluded once that
   * parent is chosen. Falls back to `parentValue` for single-parent fields.
   */
  parentValues?: Record<string, string | null | undefined>;
  /** Render the option but make it unselectable (e.g. a unit that is not available). */
  disabled?: boolean;
  /**
   * Hide the option from the list entirely (e.g. a non-available unit in the CRM
   * picker). Unlike `disabled`, a hidden option is not rendered — except when it
   * is the field's currently-selected value, so editing a record never drops its
   * own stored value. See `visibleOptions`.
   */
  hidden?: boolean;
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
  /** Optional input placeholder (falls back to the label). */
  placeholder?: string;
  placeholderAr?: string;
  /**
   * Name of the parent select field (or several, for multi-parent narrowing).
   * This field's options are filtered to those whose ancestor id(s) match every
   * parent field that currently has a value, and the value is reset whenever any
   * parent changes. When a parent has no value, it imposes no constraint.
   */
  dependsOn?: string | string[];
  /** Render a searchable combobox instead of a plain select. */
  searchable?: boolean;
  /**
   * Field used only to narrow other (cascading) selects — excluded from the
   * submitted payload. Useful for hierarchy filters that are not stored columns.
   */
  filterOnly?: boolean;
}

export interface ResourceColumn<T> {
  header: string;
  headerAr?: string;
  render: (row: T) => React.ReactNode;
}

/**
 * A toolbar filter rendered as a select next to the search box. The chosen
 * value is injected into the list query under `name` (server-side filtering, so
 * it combines cleanly with paging). An "All" option clears the filter.
 */
export interface ResourceFilter {
  name: string;
  label: string;
  labelAr?: string;
  options: SelectOption[];
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
  /**
   * Module key for the per-row Attachments action (links uploads to this record
   * in the central Document Management repository). Defaults to the resource
   * path derived from `getListQueryKey` (e.g. `/api/units` -> `units`).
   */
  attachmentsModuleKey?: string;
  /** Show the per-row Attachments action. Defaults to true. */
  attachments?: boolean;
  /** Toolbar select filters injected into the list query (server-side). */
  filters?: ResourceFilter[];
  pageSize?: number;
}

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
    attachmentsModuleKey,
    attachments = true,
    filters,
    pageSize = 10,
  } = props;

  const attachmentsKey = (() => {
    if (!attachments) return "";
    if (attachmentsModuleKey) return attachmentsModuleKey;
    const first = getListQueryKey()?.[0];
    return typeof first === "string"
      ? first.replace(/^\/api\//, "").replace(/^\//, "")
      : "";
  })();

  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const params: Record<string, unknown> = { page, pageSize };
  if (search) params.search = search;
  for (const [k, v] of Object.entries(filterValues)) {
    if (v) params[k] = v;
  }

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
        <h2 className="flex-1 text-center text-xl font-semibold tracking-tight">{heading}</h2>
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

      {(searchable || (filters && filters.length > 0)) && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
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
          {filters?.map((filter) => {
            const filterLabel =
              language === "ar" && filter.labelAr ? filter.labelAr : filter.label;
            return (
              <Select
                key={filter.name}
                value={filterValues[filter.name] || ALL}
                onValueChange={(v) => {
                  setFilterValues((prev) => ({ ...prev, [filter.name]: v === ALL ? "" : v }));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder={filterLabel} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("common.all")}</SelectItem>
                  {filter.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {language === "ar" && o.labelAr ? o.labelAr : o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          })}
        </div>
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
                    {attachmentsKey && (
                      <DocumentsRowAction moduleKey={attachmentsKey} sourceId={row.id} />
                    )}
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
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  const fieldLabel = (f: ResourceField) =>
    language === "ar" && f.labelAr ? f.labelAr : f.label;

  const fieldPlaceholder = (f: ResourceField) => {
    const p = language === "ar" && f.placeholderAr ? f.placeholderAr : f.placeholder;
    return p ?? fieldLabel(f);
  };

  const buildPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.filterOnly) continue;
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

    // Save-blocking validation: collect every empty required field, surface an
    // inline error on each, and focus the first invalid control. Unlike the
    // native `required` attribute this works consistently for RTL and custom
    // Select controls.
    const nextErrors: Record<string, boolean> = {};
    let firstInvalid: string | null = null;
    for (const f of fields) {
      if (f.name === "companyId") continue;
      if (f.filterOnly) continue;
      if (isEdit && f.createOnly) continue;
      if (!f.required) continue;
      const raw = formData[f.name];
      const empty =
        raw === undefined || raw === NONE || (typeof raw === "string" && raw.trim() === "");
      if (empty) {
        nextErrors[f.name] = true;
        if (!firstInvalid) firstInvalid = f.name;
      }
    }
    if (firstInvalid) {
      setErrors(nextErrors);
      toast({ title: t("validation.fix_errors"), variant: "destructive" });
      fieldRefs.current[firstInvalid]?.focus();
      return;
    }

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

  const setValue = (name: string, value: string) => {
    setFormData((prev) => resetDescendants(fields, { ...prev, [name]: value }, name));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: false } : prev));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields
        .filter((f) => f.name !== "companyId")
        .map((f) => {
          const disabled = isEdit && f.createOnly;
          const hasError = !!errors[f.name];
          const errorClass = hasError
            ? "border-destructive focus-visible:ring-destructive"
            : "";
          return (
            <div key={f.name} className="space-y-2">
              <Label>
                {fieldLabel(f)}
                {f.required ? (
                  <span className="text-destructive"> *</span>
                ) : (
                  <span className="text-muted-foreground text-xs font-normal">
                    {" "}
                    ({t("common.optional")})
                  </span>
                )}
              </Label>
              {f.type === "textarea" ? (
                <Textarea
                  ref={(el) => {
                    fieldRefs.current[f.name] = el;
                  }}
                  value={formData[f.name] ?? ""}
                  onChange={(e) => setValue(f.name, e.target.value)}
                  placeholder={fieldPlaceholder(f)}
                  aria-invalid={hasError}
                  className={errorClass}
                  dir={f.rtl ? "rtl" : undefined}
                />
              ) : f.type === "boolean" ? (
                <Select
                  value={formData[f.name] || "false"}
                  onValueChange={(v) => setValue(f.name, v)}
                >
                  <SelectTrigger
                    ref={(el) => {
                      fieldRefs.current[f.name] = el;
                    }}
                    aria-invalid={hasError}
                    className={errorClass}
                  >
                    <SelectValue placeholder={fieldLabel(f)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">{language === "ar" ? "نعم" : "Yes"}</SelectItem>
                    <SelectItem value="false">{language === "ar" ? "لا" : "No"}</SelectItem>
                  </SelectContent>
                </Select>
              ) : f.type === "select" && f.searchable ? (
                <SearchableSelect
                  options={visibleOptions(fields, formData, f)}
                  value={formData[f.name] ?? ""}
                  onChange={(v) => setValue(f.name, v)}
                  placeholder={fieldPlaceholder(f)}
                  searchPlaceholder={t("common.search")}
                  emptyText={t("common.no_results")}
                  clearable={!f.required}
                  language={language}
                  hasError={hasError}
                  triggerRef={(el) => {
                    fieldRefs.current[f.name] = el;
                  }}
                />
              ) : f.type === "select" ? (
                <Select
                  value={formData[f.name] || (f.required ? "" : NONE)}
                  onValueChange={(v) => setValue(f.name, v)}
                >
                  <SelectTrigger
                    ref={(el) => {
                      fieldRefs.current[f.name] = el;
                    }}
                    aria-invalid={hasError}
                    className={errorClass}
                  >
                    <SelectValue placeholder={fieldLabel(f)} />
                  </SelectTrigger>
                  <SelectContent>
                    {!f.required && <SelectItem value={NONE}>—</SelectItem>}
                    {visibleOptions(fields, formData, f).map((o) => (
                      <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                        {language === "ar" && o.labelAr ? o.labelAr : o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  ref={(el) => {
                    fieldRefs.current[f.name] = el;
                  }}
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
                  placeholder={fieldPlaceholder(f)}
                  aria-invalid={hasError}
                  disabled={disabled}
                  className={errorClass}
                  dir={f.rtl ? "rtl" : undefined}
                />
              )}
              {hasError && (
                <p className="text-xs text-destructive">{t("validation.required")}</p>
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

/**
 * A searchable single-select combobox built on cmdk + popover. Used for fields
 * with many options (e.g. units). cmdk filters by each item's `value` prop, so
 * we set that to the visible label and resolve the real option value via a
 * closure on select. Disabled options render but are not selectable.
 */
function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  clearable,
  language,
  hasError,
  triggerRef,
}: {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  clearable: boolean;
  language: string;
  hasError: boolean;
  triggerRef: (el: HTMLButtonElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const optLabel = (o: SelectOption) =>
    language === "ar" && o.labelAr ? o.labelAr : o.label;
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={hasError}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            hasError && "border-destructive focus-visible:ring-destructive",
          )}
        >
          <span className="truncate">{selected ? optLabel(selected) : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {clearable && (
                <CommandItem
                  value="—"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value ? "opacity-0" : "opacity-100")}
                  />
                  —
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${optLabel(o)} ${o.value}`}
                  disabled={o.disabled}
                  onSelect={() => {
                    if (o.disabled) return;
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === o.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {optLabel(o)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
