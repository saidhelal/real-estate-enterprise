import { useState } from "react";
import { useLanguage } from "@/lib/language-provider";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentsRowAction } from "@/components/documents/documents-row-action";
import { 
  useListCompanies, 
  useCreateCompany, 
  useUpdateCompany, 
  useDeleteCompany,
  getListCompaniesQueryKey,
  setNextChangeReason,
  CompanyInput,
  Company
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

/** Server governance middleware answers a governed mutation with 202 + this shape. */
function isPendingApproval(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as { pendingApproval?: unknown }).pendingApproval === true
  );
}

/** Extract a human-readable error message from a failed API mutation. */
function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object") {
      const msg = (data as { error?: unknown }).error;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export default function CompaniesPage() {
  const { t } = useLanguage();
  const { data: companies, isLoading } = useListCompanies();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteCompany();

  const handleDelete = (company: Company) => {
    const reason = window.prompt(t("governance.reason_prompt") ?? "");
    if (reason === null) return;
    if (!reason.trim()) {
      toast({ title: t("governance.reason_required"), variant: "destructive" });
      return;
    }
    setNextChangeReason(reason.trim(), company.name);
    deleteMutation.mutate(
      { id: company.id },
      {
        onSuccess: (result: unknown) => {
          toast({
            title: isPendingApproval(result)
              ? t("governance.submitted")
              : t("common.deleted"),
          });
          queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
        },
        onError: (error: unknown) => {
          toast({
            title: t("common.error"),
            description: getApiErrorMessage(error, t("common.error")),
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <PageHeader title={t("companies.title")} bordered={false} />
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="me-2 h-4 w-4" />
              {t("companies.create")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("companies.create")}</DialogTitle>
            </DialogHeader>
            <CompanyForm onSuccess={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.code")}</TableHead>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.name_ar")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableState colSpan={5} isLoading loadingLabel={t("common.loading")} emptyTitle={t("common.no_results")} />
            ) : companies?.length === 0 ? (
              <TableState colSpan={5} isEmpty emptyTitle={t("common.no_results")} />
            ) : (
              companies?.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.code}</TableCell>
                  <TableCell>{company.name}</TableCell>
                  <TableCell>{company.nameAr}</TableCell>
                  <TableCell>
                    <Badge variant={company.isActive ? "default" : "secondary"}>
                      {company.isActive ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end space-x-2">
                    <DocumentsRowAction moduleKey="companies" sourceId={company.id} />
                    <Button variant="ghost" size="icon" onClick={() => setEditingCompany(company)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(company)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableFrame>

      <Dialog open={!!editingCompany} onOpenChange={(open) => !open && setEditingCompany(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.edit")}</DialogTitle>
          </DialogHeader>
          {editingCompany && (
            <CompanyForm 
              company={editingCompany} 
              onSuccess={() => setEditingCompany(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompanyForm({ company, onSuccess }: { company?: Company; onSuccess: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateCompany();
  const updateMutation = useUpdateCompany();
  
  const [formData, setFormData] = useState({
    code: company?.code || "",
    name: company?.name || "",
    nameAr: company?.nameAr || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (company) {
      updateMutation.mutate(
        { id: company.id, data: formData },
        {
          onSuccess: (result: unknown) => {
            toast({
              title: isPendingApproval(result)
                ? t("governance.submitted")
                : t("common.saved"),
            });
            queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
            onSuccess();
          },
          onError: (error: unknown) => {
            toast({
              title: t("common.error"),
              description: getApiErrorMessage(error, t("common.error")),
              variant: "destructive",
            });
          },
        }
      );
    } else {
      createMutation.mutate(
        { data: formData as CompanyInput },
        {
          onSuccess: () => {
            toast({ title: t("common.created") });
            queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
            onSuccess();
          },
          onError: (error: unknown) => {
            toast({
              title: t("common.error"),
              description: getApiErrorMessage(error, t("common.error")),
              variant: "destructive",
            });
          },
        }
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t("common.code")}</Label>
        <Input 
          value={formData.code} 
          onChange={(e) => setFormData({...formData, code: e.target.value})} 
          required 
          disabled={!!company}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("common.name_en")}</Label>
        <Input 
          value={formData.name} 
          onChange={(e) => setFormData({...formData, name: e.target.value})} 
          required 
        />
      </div>
      <div className="space-y-2">
        <Label>{t("common.name_ar")}</Label>
        <Input 
          value={formData.nameAr} 
          onChange={(e) => setFormData({...formData, nameAr: e.target.value})} 
          required 
          dir="rtl"
        />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {company ? t("common.update") : t("common.create")}
        </Button>
      </div>
    </form>
  );
}
