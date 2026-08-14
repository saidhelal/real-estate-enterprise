import { useState } from "react";
import { useLanguage } from "@/lib/language-provider";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentsRowAction } from "@/components/documents/documents-row-action";
import { 
  useListRoles, 
  useCreateRole, 
  useUpdateRole, 
  useDeleteRole,
  useListPermissions,
  useListRoleUsers,
  getListRoleUsersQueryKey,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

export default function RolesPage() {
  const { t } = useLanguage();
  const { data: roles, isLoading } = useListRoles();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [holdersFor, setHoldersFor] = useState<Role | null>(null);

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
        <PageHeader title={t("roles.title")} bordered={false} />
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="me-2 h-4 w-4" />
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

      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.description")}</TableHead>
              <TableHead>{t("roles.system")}</TableHead>
              <TableHead>{t("roles.permission_count")}</TableHead>
              <TableHead>{t("roles.users")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableState colSpan={6} isLoading loadingLabel={t("common.loading")} emptyTitle={t("common.no_results")} />
            ) : roles?.length === 0 ? (
              <TableState colSpan={6} isEmpty emptyTitle={t("common.no_results")} />
            ) : (
              roles?.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell>{role.description}</TableCell>
                  <TableCell>
                    {role.isSystem && <Badge variant="secondary">{t("roles.system")}</Badge>}
                  </TableCell>
                  <TableCell>
                    {role.permissions.includes("*") ? (
                      <Badge>{t("roles.full_access")}</Badge>
                    ) : (
                      role.permissions.length
                    )}
                  </TableCell>
                  <TableCell>
                    {role.userCount > 0 ? (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => setHoldersFor(role)}
                      >
                        {role.userCount}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end space-x-2">
                    <DocumentsRowAction moduleKey="roles" sourceId={role.id} />
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
      </TableFrame>

      <RoleHoldersDialog role={holdersFor} onClose={() => setHoldersFor(null)} />

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

/**
 * Who holds a role.
 *
 * The list already showed a count; this answers the question the count raises.
 * It reads the server's own endpoint rather than filtering a client-side user
 * list, so a viewer without `users.view` gets nothing back — the same answer
 * the API would give any other way of asking.
 */
function RoleHoldersDialog({ role, onClose }: { role: Role | null; onClose: () => void }) {
  const { t } = useLanguage();
  const { data, isLoading } = useListRoleUsers(role?.id ?? "", {
    query: { enabled: !!role, queryKey: getListRoleUsersQueryKey(role?.id ?? "") },
  });

  return (
    <Dialog open={!!role} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{`${t("roles.holders")}${role ? ` — ${role.name}` : ""}`}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("roles.no_holders")}</p>
        ) : (
          <ul className="divide-y">
            {(data ?? []).map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium">{u.fullName}</div>
                  <div className="text-xs text-muted-foreground">{u.username}</div>
                </div>
                <Badge variant={u.isActive ? "secondary" : "outline"}>
                  {u.isActive ? t("common.active") : t("common.inactive")}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
