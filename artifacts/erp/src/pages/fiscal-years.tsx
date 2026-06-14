import { useState } from "react";
import { useLanguage } from "@/lib/language-provider";
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
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
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
    if (confirm("Are you sure you want to delete this fiscal year?")) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            toast({ title: "Fiscal year deleted" });
            queryClient.invalidateQueries({ queryKey: getListFiscalYearsQueryKey() });
          },
          onError: () => {
            toast({ title: "Failed to delete fiscal year", variant: "destructive" });
          }
        }
      );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("fiscal_years.title")}</h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
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

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">Loading...</TableCell>
              </TableRow>
            ) : fiscalYears?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">No fiscal years found</TableCell>
              </TableRow>
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
                  <TableCell className="text-right space-x-2">
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
      </div>

      <Dialog open={!!editingFiscalYear} onOpenChange={(open) => !open && setEditingFiscalYear(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Fiscal Year</DialogTitle>
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
            toast({ title: "Fiscal year updated" });
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
            toast({ title: "Fiscal year created" });
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
        <Label>Name (e.g. 2026)</Label>
        <Input 
          value={formData.name} 
          onChange={(e) => setFormData({...formData, name: e.target.value})} 
          required 
        />
      </div>
      <div className="space-y-2">
        <Label>Start Date</Label>
        <Input 
          type="date"
          value={formData.startDate} 
          onChange={(e) => setFormData({...formData, startDate: e.target.value})} 
          required 
        />
      </div>
      <div className="space-y-2">
        <Label>End Date</Label>
        <Input 
          type="date"
          value={formData.endDate} 
          onChange={(e) => setFormData({...formData, endDate: e.target.value})} 
          required 
        />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>Cancel</Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {fiscalYear ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
