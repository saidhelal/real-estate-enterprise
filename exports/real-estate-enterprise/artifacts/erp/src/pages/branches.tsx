import { useState } from "react";
import { useLanguage } from "@/lib/language-provider";
import { DocumentsRowAction } from "@/components/documents/documents-row-action";
import { 
  useListBranches, 
  useCreateBranch, 
  useUpdateBranch, 
  useDeleteBranch,
  useListCompanies,
  getListBranchesQueryKey,
  setNextChangeReason,
  BranchInput,
  Branch
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function BranchesPage() {
  const { t } = useLanguage();
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const { data: companies } = useListCompanies();
  const { data: branches, isLoading } = useListBranches(
    selectedCompany !== "all" ? { companyId: selectedCompany } : undefined
  );
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteBranch();

  const handleDelete = (branch: Branch) => {
    const reason = window.prompt(t("governance.reason_prompt") ?? "");
    if (reason === null) return;
    if (!reason.trim()) {
      toast({ title: t("governance.reason_required"), variant: "destructive" });
      return;
    }
    setNextChangeReason(reason.trim(), branch.name);
    deleteMutation.mutate(
      { id: branch.id },
      {
        onSuccess: (result: unknown) => {
          toast({
            title: isPendingApproval(result)
              ? t("governance.submitted")
              : t("common.deleted"),
          });
          queryClient.invalidateQueries({ queryKey: getListBranchesQueryKey() });
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
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight">{t("branches.title")}</h2>
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t("branches.filter_company")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("branches.all_companies")}</SelectItem>
              {companies?.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("branches.create")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("branches.create")}</DialogTitle>
            </DialogHeader>
            <BranchForm onSuccess={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.code")}</TableHead>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.company")}</TableHead>
              <TableHead>{t("common.manager")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">{t("common.loading")}</TableCell>
              </TableRow>
            ) : branches?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">{t("common.no_results")}</TableCell>
              </TableRow>
            ) : (
              branches?.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.code}</TableCell>
                  <TableCell>{branch.name}</TableCell>
                  <TableCell>{branch.companyName}</TableCell>
                  <TableCell>{branch.manager || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={branch.isActive ? "default" : "secondary"}>
                      {branch.isActive ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <DocumentsRowAction moduleKey="branches" sourceId={branch.id} />
                    <Button variant="ghost" size="icon" onClick={() => setEditingBranch(branch)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(branch)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingBranch} onOpenChange={(open) => !open && setEditingBranch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.edit")}</DialogTitle>
          </DialogHeader>
          {editingBranch && (
            <BranchForm 
              branch={editingBranch} 
              onSuccess={() => setEditingBranch(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BranchForm({ branch, onSuccess }: { branch?: Branch; onSuccess: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();
  const { data: companies } = useListCompanies();
  
  const [formData, setFormData] = useState({
    code: branch?.code || "",
    name: branch?.name || "",
    nameAr: branch?.nameAr || "",
    companyId: branch?.companyId || "",
    manager: branch?.manager || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (branch) {
      updateMutation.mutate(
        { id: branch.id, data: formData },
        {
          onSuccess: (result: unknown) => {
            toast({
              title: isPendingApproval(result)
                ? t("governance.submitted")
                : t("common.saved"),
            });
            queryClient.invalidateQueries({ queryKey: getListBranchesQueryKey() });
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
        { data: formData as BranchInput },
        {
          onSuccess: () => {
            toast({ title: t("common.created") });
            queryClient.invalidateQueries({ queryKey: getListBranchesQueryKey() });
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
        <Label>{t("common.company")}</Label>
        <Select 
          value={formData.companyId} 
          onValueChange={(val) => setFormData({...formData, companyId: val})}
          disabled={!!branch}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("branches.select_company")} />
          </SelectTrigger>
          <SelectContent>
            {companies?.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t("common.code")}</Label>
        <Input 
          value={formData.code} 
          onChange={(e) => setFormData({...formData, code: e.target.value})} 
          required 
          disabled={!!branch}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("common.name")}</Label>
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
      <div className="space-y-2">
        <Label>{t("common.manager")}</Label>
        <Input 
          value={formData.manager} 
          onChange={(e) => setFormData({...formData, manager: e.target.value})} 
        />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {branch ? t("common.update") : t("common.create")}
        </Button>
      </div>
    </form>
  );
}
