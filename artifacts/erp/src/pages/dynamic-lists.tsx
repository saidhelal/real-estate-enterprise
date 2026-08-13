import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListLookupTypes,
  useCreateLookupType,
  useUpdateLookupType,
  useDeleteLookupType,
  getListLookupTypesQueryKey,
  type LookupType,
  type LookupTypeInput,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { LookupValuesManager } from "@/components/master-data/lookup-values-manager";
import { cn } from "@/lib/utils";

export default function DynamicListsPage() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = { pageSize: 200 };
  const queryKey = getListLookupTypesQueryKey(params);
  const { data, isLoading } = useListLookupTypes(params, { query: { queryKey } });

  const [selected, setSelected] = useState<LookupType | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<LookupType | null>(null);

  const deleteMutation = useDeleteLookupType();
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const customTypes = (data?.data ?? [])
    .filter((type) => !type.isSystem)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const typeName = (type: LookupType) => (language === "ar" ? type.nameAr : type.nameEn);

  const onError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    toast({ title: t("common.error"), description: message, variant: "destructive" });
  };

  const handleDelete = (type: LookupType) => {
    if (!confirm(t("common.delete_confirm"))) return;
    deleteMutation.mutate(
      { id: type.id },
      {
        onSuccess: () => {
          toast({ title: t("common.deleted") });
          if (selected?.id === type.id) setSelected(null);
          invalidate();
        },
        onError,
      },
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between">
        <PageHeader
          title={t("dynamic_lists.title")}
          description={t("dynamic_lists.subtitle")}
          bordered={false}
        />
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          {t("dynamic_lists.create")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[320px_1fr]">
        <div className="rounded-md border bg-card">
          <ScrollArea className="h-[600px]">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
            ) : customTypes.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">{t("dynamic_lists.empty")}</div>
            ) : (
              <ul className="divide-y">
                {customTypes.map((type) => (
                  <li key={type.id} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setSelected(type)}
                      className={cn(
                        "flex flex-1 flex-col items-start gap-1 px-4 py-3 text-start transition-colors hover:bg-accent",
                        selected?.id === type.id && "bg-accent",
                      )}
                    >
                      <span className="font-medium">{typeName(type)}</span>
                      <span className="font-mono text-xs text-muted-foreground">{type.code}</span>
                    </button>
                    <div className="flex gap-1 pe-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(type)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(type)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        <div className="rounded-md border bg-card p-6">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{typeName(selected)}</h3>
                <Badge variant="outline">{t("dynamic_lists.custom")}</Badge>
              </div>
              <LookupValuesManager typeId={selected.id} />
            </div>
          ) : (
            <div className="flex h-full min-h-[400px] items-center justify-center text-center text-muted-foreground">
              {t("dynamic_lists.select")}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("dynamic_lists.create")}</DialogTitle></DialogHeader>
          <TypeForm onSuccess={() => { setIsCreateOpen(false); invalidate(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("common.edit")}</DialogTitle></DialogHeader>
          {editing && <TypeForm type={editing} onSuccess={() => { setEditing(null); invalidate(); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TypeForm({ type, onSuccess }: { type?: LookupType; onSuccess: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const createMutation = useCreateLookupType();
  const updateMutation = useUpdateLookupType();

  const [form, setForm] = useState({
    code: type?.code ?? "",
    nameEn: type?.nameEn ?? "",
    nameAr: type?.nameAr ?? "",
    description: type?.description ?? "",
  });

  const onError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    toast({ title: t("common.error"), description: message, variant: "destructive" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type) {
      updateMutation.mutate(
        { id: type.id, data: { nameEn: form.nameEn, nameAr: form.nameAr, description: form.description } },
        { onSuccess: () => { toast({ title: t("common.saved") }); onSuccess(); }, onError },
      );
    } else {
      const data: LookupTypeInput = {
        code: form.code,
        nameEn: form.nameEn,
        nameAr: form.nameAr,
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
        <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={!!type} placeholder="custom_category" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("master_data.name_en")}</Label>
          <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>{t("master_data.name_ar")}</Label>
          <Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required dir="rtl" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("common.description")}</Label>
        <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onSuccess}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {type ? t("common.update") : t("common.create")}
        </Button>
      </div>
    </form>
  );
}
