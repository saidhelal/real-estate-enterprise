import { useState } from "react";
import { useLanguage } from "@/lib/language-provider";
import { 
  useListRoles, 
  useCreateRole, 
  useUpdateRole, 
  useDeleteRole,
  useListPermissions,
  getListRolesQueryKey,
  RoleInput,
  Role
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

export default function RolesPage() {
  const { t } = useLanguage();
  const { data: roles, isLoading } = useListRoles();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteRole();

  const handleDelete = (id: string) => {
    if (confirm(t("common.delete_confirm"))) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            toast({ title: t("common.deleted") });
            queryClient.invalidateQueries({ queryKey: getListRolesQueryKey() });
          },
          onError: (err: any) => {
            toast({ title: t("common.error"), description: err?.message, variant: "destructive" });
          }
        }
      );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("roles.title")}</h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("roles.create")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("roles.create")}</DialogTitle>
            </DialogHeader>
            <RoleForm onSuccess={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.description")}</TableHead>
              <TableHead>{t("roles.system")}</TableHead>
              <TableHead>{t("roles.users")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">{t("common.loading")}</TableCell>
              </TableRow>
            ) : roles?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">{t("common.no_results")}</TableCell>
              </TableRow>
            ) : (
              roles?.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell>{role.description}</TableCell>
                  <TableCell>
                    {role.isSystem && <Badge variant="secondary">{t("roles.system")}</Badge>}
                  </TableCell>
                  <TableCell>{role.userCount}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => setEditingRole(role)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!role.isSystem && (
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(role.id)}>
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

      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("common.edit")}</DialogTitle>
          </DialogHeader>
          {editingRole && (
            <RoleForm 
              role={editingRole} 
              onSuccess={() => setEditingRole(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleForm({ role, onSuccess }: { role?: Role; onSuccess: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();
  const { data: permissions } = useListPermissions();
  
  const [formData, setFormData] = useState({
    name: role?.name || "",
    description: role?.description || "",
    permissions: role?.permissions || [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (role) {
      updateMutation.mutate(
        { id: role.id, data: formData },
        {
          onSuccess: () => {
            toast({ title: "Role updated" });
            queryClient.invalidateQueries({ queryKey: getListRolesQueryKey() });
            onSuccess();
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: formData as RoleInput },
        {
          onSuccess: () => {
            toast({ title: "Role created" });
            queryClient.invalidateQueries({ queryKey: getListRolesQueryKey() });
            onSuccess();
          }
        }
      );
    }
  };

  const togglePermission = (code: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(code)
        ? prev.permissions.filter(p => p !== code)
        : [...prev.permissions, code]
    }));
  };

  // Group permissions by module
  const modules = permissions?.reduce((acc, curr) => {
    if (!acc[curr.module]) acc[curr.module] = [];
    acc[curr.module].push(curr);
    return acc;
  }, {} as Record<string, typeof permissions>);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("common.name")}</Label>
          <Input 
            value={formData.name} 
            onChange={(e) => setFormData({...formData, name: e.target.value})} 
            required 
            disabled={role?.isSystem}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("common.description")}</Label>
          <Input 
            value={formData.description} 
            onChange={(e) => setFormData({...formData, description: e.target.value})} 
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>{t("roles.permissions")}</Label>
        <ScrollArea className="h-[300px] border rounded-md p-4">
          {modules && Object.entries(modules).map(([module, perms]) => (
            <div key={module} className="mb-4">
              <h4 className="font-semibold capitalize mb-2">{module}</h4>
              <div className="grid grid-cols-2 gap-2">
                {perms.map(p => (
                  <div key={p.code} className="flex items-center space-x-2">
                    <Checkbox 
                      id={p.code}
                      checked={formData.permissions.includes(p.code)}
                      onCheckedChange={() => togglePermission(p.code)}
                      disabled={role?.isSystem}
                    />
                    <label htmlFor={p.code} className="text-sm cursor-pointer">{p.description}</label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || role?.isSystem}>
          {role ? t("common.update") : t("common.create")}
        </Button>
      </div>
    </form>
  );
}
