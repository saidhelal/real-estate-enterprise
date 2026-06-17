import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListLookupValues,
  useCreateLookupValue,
  useUpdateLookupValue,
  useDeleteLookupValue,
  useActivateLookupValue,
  useDeactivateLookupValue,
  useArchiveLookupValue,
  useUnarchiveLookupValue,
  useReorderLookupValues,
  getListLookupValuesQueryKey,
  type LookupValue,
  type LookupValueInput,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Archive,
  ArchiveRestore,
  Power,
  PowerOff,
} from "lucide-react";

export function LookupValuesManager({ typeId }: { typeId: string }) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = { typeId, pageSize: 200 };
  const queryKey = getListLookupValuesQueryKey(params);
  const { data, isLoading } = useListLookupValues(params, {
    query: { queryKey },
  });
  const values = (data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<LookupValue | null>(null);

  const deleteMutation = useDeleteLookupValue();
  const activateMutation = useActivateLookupValue();
  const deactivateMutation = useDeactivateLookupValue();
  const archiveMutation = useArchiveLookupValue();
  const unarchiveMutation = useUnarchiveLookupValue();
  const reorderMutation = useReorderLookupValues();

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const onError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    toast({ title: t("common.error"), description: message, variant: "destructive" });
  };

  const handleDelete = (row: LookupValue) => {
    if (!confirm(t("common.delete_confirm"))) return;
    deleteMutation.mutate(
      { id: row.id },
      { onSuccess: () => { toast({ title: t("common.deleted") }); invalidate(); }, onError },
    );
  };

  const handleToggleActive = (row: LookupValue) => {
    const mutation = row.isActive ? deactivateMutation : activateMutation;
    mutation.mutate(
      { id: row.id },
      { onSuccess: () => { toast({ title: t("common.saved") }); invalidate(); }, onError },
    );
  };

  const handleToggleArchive = (row: LookupValue) => {
    const mutation = row.isArchived ? unarchiveMutation : archiveMutation;
    mutation.mutate(
      { id: row.id },
      { onSuccess: () => { toast({ title: t("common.saved") }); invalidate(); }, onError },
    );
  };

  const handleMove = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= values.length) return;
    const a = values[index];
    const b = values[target];
    reorderMutation.mutate(
      { data: { items: [{ id: a.id, sortOrder: b.sortOrder }, { id: b.id, sortOrder: a.sortOrder }] } },
      { onSuccess: invalidate, onError },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("master_data.add_value")}
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">{t("master_data.order")}</TableHead>
              <TableHead>{t("common.code")}</TableHead>
              <TableHead>{t("master_data.label_en")}</TableHead>
              <TableHead>{t("master_data.label_ar")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center h-24">{t("common.loading")}</TableCell></TableRow>
            ) : values.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center h-24">{t("common.no_results")}</TableCell></TableRow>
            ) : (
              values.map((row, index) => (
                <TableRow key={row.id} className={row.isArchived ? "opacity-60" : undefined}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0 || reorderMutation.isPending} onClick={() => handleMove(index, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === values.length - 1 || reorderMutation.isPending} onClick={() => handleMove(index, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.code}</TableCell>
                  <TableCell>{row.labelEn}</TableCell>
                  <TableCell dir="rtl">{row.labelAr}</TableCell>
                  <TableCell className="space-x-1">
                    <Badge variant={row.isActive ? "default" : "secondary"}>
                      {row.isActive ? t("common.active") : t("common.inactive")}
                    </Badge>
                    {row.isArchived && <Badge variant="outline">{t("master_data.archived")}</Badge>}
                    {row.isSystem && <Badge variant="outline">{t("master_data.system")}</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={row.isActive ? t("master_data.deactivate") : t("master_data.activate")} onClick={() => handleToggleActive(row)}>
                        {row.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={row.isArchived ? t("master_data.unarchive") : t("master_data.archive")} onClick={() => handleToggleArchive(row)}>
                        {row.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={t("common.edit")} onClick={() => setEditing(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!row.isSystem && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title={t("common.delete")} onClick={() => handleDelete(row)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("master_data.add_value")}</DialogTitle></DialogHeader>
          <ValueForm typeId={typeId} onSuccess={() => { setIsCreateOpen(false); invalidate(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("common.edit")}</DialogTitle></DialogHeader>
          {editing && (
            <ValueForm typeId={typeId} value={editing} onSuccess={() => { setEditing(null); invalidate(); }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ValueForm({
  typeId,
  value,
  onSuccess,
}: {
  typeId: string;
  value?: LookupValue;
  onSuccess: () => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const createMutation = useCreateLookupValue();
  const updateMutation = useUpdateLookupValue();

  const [form, setForm] = useState({
    code: value?.code ?? "",
    labelEn: value?.labelEn ?? "",
    labelAr: value?.labelAr ?? "",
    description: value?.description ?? "",
  });

  const onError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    toast({ title: t("common.error"), description: message, variant: "destructive" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value) {
      updateMutation.mutate(
        { id: value.id, data: { labelEn: form.labelEn, labelAr: form.labelAr, description: form.description } },
        { onSuccess: () => { toast({ title: t("common.saved") }); onSuccess(); }, onError },
      );
    } else {
      const data: LookupValueInput = {
        typeId,
        code: form.code,
        labelEn: form.labelEn,
        labelAr: form.labelAr,
        description: form.description || undefined,
      };
      createMutation.mutate(
        { data },
        { onSuccess: () => { toast({ title: t("common.created") }); onSuccess(); }, onError },
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t("common.code")}</Label>
        <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={!!value} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("master_data.label_en")}</Label>
          <Input value={form.labelEn} onChange={(e) => setForm({ ...form, labelEn: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>{t("master_data.label_ar")}</Label>
          <Input value={form.labelAr} onChange={(e) => setForm({ ...form, labelAr: e.target.value })} required dir="rtl" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("common.description")}</Label>
        <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onSuccess}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {value ? t("common.update") : t("common.create")}
        </Button>
      </div>
    </form>
  );
}
