import { useState } from "react";
import { useLanguage } from "@/lib/language-provider";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentsRowAction } from "@/components/documents/documents-row-action";
import { 
  useListFiscalYears, 
  useCreateFiscalYear, 
  useUpdateFiscalYear, 
  useDeleteFiscalYear,
  getListFiscalYearsQueryKey,
  FiscalYearInput,
  FiscalYear,
  FiscalYearStatus
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFrame,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableState } from "@/components/ui/states";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

export default function FiscalYearsPage() {
  const { t } = useLanguage();
  const { data: fiscalYears, isLoading } = useListFiscalYears();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingFiscalYear, setEditingFiscalYear] = useState<FiscalYear | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteFiscalYear();

  const handleDelete = (id: string) => {
    if (confirm(t("common.delete_confirm"))) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            toast({ title: t("common.deleted") });
            queryClient.invalidateQueries({ queryKey: getListFiscalYearsQueryKey() });
          },
          onError: () => {
            toast({ title: t("common.error"), variant: "destructive" });
          }
        }
      );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <PageHeader title={t("fiscal_years.title")} bordered={false} />
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="me-2 h-4 w-4" />
              {t("fiscal_years.create")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("fiscal_years.create")}</DialogTitle>
            </DialogHeader>
            <FiscalYearForm onSuccess={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.start_date")}</TableHead>
              <TableHead>{t("common.end_date")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableState colSpan={5} isLoading loadingLabel={t("common.loading")} emptyTitle={t("common.no_results")} />
            ) : fiscalYears?.length === 0 ? (
              <TableState colSpan={5} isEmpty emptyTitle={t("common.no_results")} />
            ) : (
              fiscalYears?.map((fy) => (
                <TableRow key={fy.id}>
                  <TableCell className="font-medium">{fy.name}</TableCell>
                  <TableCell>{format(new Date(fy.startDate), 'PP')}</TableCell>
                  <TableCell>{format(new Date(fy.endDate), 'PP')}</TableCell>
                  <TableCell>
                    <Badge variant={fy.status === "open" ? "default" : "secondary"}>
                      {fy.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end space-x-2">
                    <DocumentsRowAction moduleKey="fiscal-years" sourceId={fy.id} />
                    <Button variant="ghost" size="icon" onClick={() => setEditingFiscalYear(fy)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(fy.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableFrame>

      <Dialog open={!!editingFiscalYear} onOpenChange={(open) => !open && setEditingFiscalYear(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.edit")}</DialogTitle>
          </DialogHeader>
          {editingFiscalYear && (
            <FiscalYearForm 
              fiscalYear={editingFiscalYear} 
              onSuccess={() => setEditingFiscalYear(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FiscalYearForm({ fiscalYear, onSuccess }: { fiscalYear?: FiscalYear; onSuccess: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateFiscalYear();
  const updateMutation = useUpdateFiscalYear();
  
  const [formData, setFormData] = useState({
    name: fiscalYear?.name || "",
    startDate: fiscalYear?.startDate ? new Date(fiscalYear.startDate).toISOString().split('T')[0] : "",
    endDate: fiscalYear?.endDate ? new Date(fiscalYear.endDate).toISOString().split('T')[0] : "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (fiscalYear) {
      updateMutation.mutate(
        { id: fiscalYear.id, data: formData },
        {
          onSuccess: () => {
            toast({ title: t("common.saved") });
            queryClient.invalidateQueries({ queryKey: getListFiscalYearsQueryKey() });
            onSuccess();
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: formData as FiscalYearInput },
        {
          onSuccess: () => {
            toast({ title: t("common.created") });
            queryClient.invalidateQueries({ queryKey: getListFiscalYearsQueryKey() });
            onSuccess();
          }
        }
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t("fiscal_years.name_hint")}</Label>
        <Input 
          value={formData.name} 
          onChange={(e) => setFormData({...formData, name: e.target.value})} 
          required 
        />
      </div>
      <div className="space-y-2">
        <Label>{t("common.start_date")}</Label>
        <Input 
          type="date"
          value={formData.startDate} 
          onChange={(e) => setFormData({...formData, startDate: e.target.value})} 
          required 
        />
      </div>
      <div className="space-y-2">
        <Label>{t("common.end_date")}</Label>
        <Input 
          type="date"
          value={formData.endDate} 
          onChange={(e) => setFormData({...formData, endDate: e.target.value})} 
          required 
        />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {fiscalYear ? t("common.update") : t("common.create")}
        </Button>
      </div>
    </form>
  );
}
