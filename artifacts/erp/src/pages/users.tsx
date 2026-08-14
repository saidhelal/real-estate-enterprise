import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/lib/language-provider";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentsRowAction } from "@/components/documents/documents-row-action";
import { Toolbar, ToolbarStart, ToolbarEnd } from "@/components/ui/toolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useListUsers,
  useListEmployees, 
  useCreateUser, 
  useUpdateUser, 
  useDeleteUser,
  useResetUserPassword,
  useSetUserStatus,
  useGetUserScopes,
  useSetUserScopes,
  useListBranches,
  useListDepartments,
  useListProjects,
  getListUsersQueryKey,
  getGetUserScopesQueryKey,
  setNextChangeReason,
  UserInput,
  User
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
import { Plus, Search, Pencil, Trash2, KeyRound, UserCheck, UserX, ShieldCheck, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { MoreHorizontal } from "lucide-react";

function isPendingApproval(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as { pendingApproval?: unknown }).pendingApproval === true
  );
}

export default function UsersPage() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [permissionsFor, setPermissionsFor] = useState<User | null>(null);
  const { data: allUsers, isLoading } = useListUsers({ search: search || undefined });
  const { data: employees } = useListEmployees({ pageSize: 300 });

  // Status is filtered here rather than server-side because the list endpoint
  // takes no status parameter; adding one to the contract for a handful of
  // rows would be a change to the API for a purely presentational choice.
  const users = (allUsers ?? []).filter(
    (u) => statusFilter === "all" || u.status === statusFilter,
  );

  /** The employee behind a login, if it is attached to one. */
  const employeeOf = (user: User) => {
    if (!user.employeeId) return null;
    const e = employees?.data?.find((x) => x.id === user.employeeId);
    if (!e) return null;
    return [e.firstName, e.lastName].filter(Boolean).join(" ") || e.code;
  };
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [scopingUser, setScopingUser] = useState<User | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteUser();
  const statusMutation = useSetUserStatus();

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const handleDelete = (id: string) => {
    const reason = window.prompt(t("governance.reason_prompt") ?? "");
    if (reason === null) return;
    if (!reason.trim()) {
      toast({ title: t("governance.reason_required"), variant: "destructive" });
      return;
    }
    setNextChangeReason(reason.trim(), t("users.title"));
    deleteMutation.mutate(
      { id },
      {
        onSuccess: (res: unknown) => {
          if (isPendingApproval(res)) {
            toast({ title: t("governance.submitted") });
          } else {
            toast({ title: t("common.deleted") });
          }
          refresh();
        },
        onError: () => {
          toast({ title: t("common.error"), variant: "destructive" });
        },
      },
    );
  };

  const handleToggleStatus = (user: User) => {
    const next = user.isActive ? "inactive" : "active";
    statusMutation.mutate(
      { id: user.id, data: { status: next } },
      {
        onSuccess: () => {
          toast({
            title: next === "active" ? t("users.activated") : t("users.deactivated"),
          });
          refresh();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <PageHeader title={t("users.title")} bordered={false} />
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="me-2 h-4 w-4" />
              {t("users.create")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("users.create")}</DialogTitle>
            </DialogHeader>
            <UserForm onSuccess={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Toolbar>
        <ToolbarStart>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              className="w-[220px]"
              placeholder={t("common.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("users.all_statuses")}</SelectItem>
              <SelectItem value="active">{t("common.active")}</SelectItem>
              <SelectItem value="inactive">{t("common.inactive")}</SelectItem>
              <SelectItem value="locked">{t("common.locked")}</SelectItem>
            </SelectContent>
          </Select>
        </ToolbarStart>
        <ToolbarEnd>
          <span className="text-sm text-muted-foreground">
            {`${users.length} / ${allUsers?.length ?? 0}`}
          </span>
        </ToolbarEnd>
      </Toolbar>

      <EffectivePermissionsDialog user={permissionsFor} onClose={() => setPermissionsFor(null)} />

      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.username")}</TableHead>
              <TableHead>{t("common.email")}</TableHead>
              <TableHead>{t("users.employee")}</TableHead>
              <TableHead>{t("users.roles")}</TableHead>
              <TableHead>{t("users.last_login")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableState colSpan={8} isLoading loadingLabel={t("common.loading")} emptyTitle={t("common.no_results")} />
            ) : users?.length === 0 ? (
              <TableState colSpan={8} isEmpty emptyTitle={t("common.no_results")} />
            ) : (
              users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {employeeOf(user) ?? (
                      <span className="text-xs text-muted-foreground">{t("users.no_employee")}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(user.roles ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">{t("users.no_roles")}</span>
                      ) : (
                        (user.roles ?? []).map((r) => (
                          <Badge key={r.id} variant="secondary">
                            {r.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "secondary"}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end space-x-2">
                    <DocumentsRowAction moduleKey="users" sourceId={user.id} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingUser(user)}>
                          <Pencil className="me-2 h-4 w-4" />
                          {t("common.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setResettingUser(user)}>
                          <KeyRound className="me-2 h-4 w-4" />
                          {t("users.reset_password")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPermissionsFor(user)}>
                          <ListChecks className="me-2 h-4 w-4" />
                          {t("users.effective_permissions")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setScopingUser(user)}>
                          <ShieldCheck className="me-2 h-4 w-4" />
                          {t("users.scopes")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                          {user.isActive ? (
                            <>
                              <UserX className="me-2 h-4 w-4" />
                              {t("users.deactivate")}
                            </>
                          ) : (
                            <>
                              <UserCheck className="me-2 h-4 w-4" />
                              {t("users.activate")}
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(user.id)}
                        >
                          <Trash2 className="me-2 h-4 w-4" />
                          {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableFrame>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.edit")}</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <UserForm 
              user={editingUser} 
              onSuccess={() => setEditingUser(null)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resettingUser} onOpenChange={(open) => !open && setResettingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.reset_password")}</DialogTitle>
          </DialogHeader>
          {resettingUser && (
            <ResetPasswordForm
              user={resettingUser}
              onSuccess={() => setResettingUser(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!scopingUser} onOpenChange={(open) => !open && setScopingUser(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("users.scopes")}</DialogTitle>
          </DialogHeader>
          {scopingUser && (
            <ScopesForm user={scopingUser} onSuccess={() => setScopingUser(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResetPasswordForm({ user, onSuccess }: { user: User; onSuccess: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const resetMutation = useResetUserPassword();
  const [newPassword, setNewPassword] = useState("");
  const [mustChange, setMustChange] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: t("users.password_min"), variant: "destructive" });
      return;
    }
    resetMutation.mutate(
      { id: user.id, data: { newPassword, mustChangePassword: mustChange } },
      {
        onSuccess: () => {
          toast({ title: t("users.password_reset") });
          onSuccess();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("users.reset_password_hint")} — {user.fullName}
      </p>
      <div className="space-y-2">
        <Label>{t("users.new_password")}</Label>
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="mustChange"
          checked={mustChange}
          onCheckedChange={(c) => setMustChange(c === true)}
        />
        <Label htmlFor="mustChange" className="font-normal">
          {t("users.must_change_password")}
        </Label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onSuccess}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={resetMutation.isPending}>
          {t("users.reset_password")}
        </Button>
      </div>
    </form>
  );
}

function ScopesForm({ user, onSuccess }: { user: User; onSuccess: () => void }) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: scopes, isLoading } = useGetUserScopes(user.id, {
    query: { queryKey: getGetUserScopesQueryKey(user.id) },
  });
  const { data: branches } = useListBranches();
  const { data: departments } = useListDepartments();
  const { data: projects } = useListProjects();
  const setScopes = useSetUserScopes();

  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [projectIds, setProjectIds] = useState<string[]>([]);

  useEffect(() => {
    if (scopes) {
      setBranchIds(scopes.branchIds);
      setDepartmentIds(scopes.departmentIds);
      setProjectIds(scopes.projectIds);
    }
  }, [scopes]);

  const toggle = (
    id: string,
    list: string[],
    setter: (v: string[]) => void,
  ) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const label = (item: { name: string; nameAr: string }) =>
    language === "ar" ? item.nameAr : item.name;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setScopes.mutate(
      { id: user.id, data: { branchIds, departmentIds, projectIds } },
      {
        onSuccess: () => {
          toast({ title: t("common.saved") });
          queryClient.invalidateQueries({ queryKey: getGetUserScopesQueryKey(user.id) });
          onSuccess();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("users.scopes_hint")}</p>

      <ScopeGroup
        title={t("users.branches")}
        items={branches ?? []}
        selected={branchIds}
        onToggle={(id) => toggle(id, branchIds, setBranchIds)}
        label={label}
      />
      <ScopeGroup
        title={t("users.departments")}
        items={departments?.data ?? []}
        selected={departmentIds}
        onToggle={(id) => toggle(id, departmentIds, setDepartmentIds)}
        label={label}
      />
      <ScopeGroup
        title={t("users.projects")}
        items={projects?.data ?? []}
        selected={projectIds}
        onToggle={(id) => toggle(id, projectIds, setProjectIds)}
        label={label}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onSuccess}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={setScopes.isPending}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

function ScopeGroup({
  title,
  items,
  selected,
  onToggle,
  label,
}: {
  title: string;
  items: { id: string; name: string; nameAr: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  label: (item: { name: string; nameAr: string }) => string;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">{title}</Label>
      <div className="rounded-md border p-3 space-y-2 max-h-40 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("common.no_results")}</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <Checkbox
                id={`scope-${item.id}`}
                checked={selected.includes(item.id)}
                onCheckedChange={() => onToggle(item.id)}
              />
              <Label htmlFor={`scope-${item.id}`} className="font-normal">
                {label(item)}
              </Label>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function UserForm({ user, onSuccess }: { user?: User; onSuccess: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  
  const [formData, setFormData] = useState({
    username: user?.username || "",
    fullName: user?.fullName || "",
    email: user?.email || "",
    password: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      updateMutation.mutate(
        { id: user.id, data: { fullName: formData.fullName, email: formData.email } },
        {
          onSuccess: () => {
            toast({ title: t("common.saved") });
            queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
            onSuccess();
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: formData as UserInput },
        {
          onSuccess: () => {
            toast({ title: t("common.created") });
            queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
            onSuccess();
          }
        }
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t("common.full_name")}</Label>
        <Input 
          value={formData.fullName} 
          onChange={(e) => setFormData({...formData, fullName: e.target.value})} 
          required 
        />
      </div>
      {!user && (
        <div className="space-y-2">
          <Label>{t("common.username")}</Label>
          <Input 
            value={formData.username} 
            onChange={(e) => setFormData({...formData, username: e.target.value})} 
            required 
          />
        </div>
      )}
      <div className="space-y-2">
        <Label>{t("common.email")}</Label>
        <Input 
          type="email" 
          value={formData.email} 
          onChange={(e) => setFormData({...formData, email: e.target.value})} 
          required 
        />
      </div>
      {!user && (
        <div className="space-y-2">
          <Label>{t("common.password")}</Label>
          <Input 
            type="password" 
            value={formData.password} 
            onChange={(e) => setFormData({...formData, password: e.target.value})} 
            required 
          />
        </div>
      )}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {user ? t("common.update") : t("common.create")}
        </Button>
      </div>
    </form>
  );
}

/**
 * What this user can actually do.
 *
 * Permissions are not granted to people here — they are granted to roles, and
 * a person holds the union of their roles'. Showing that union, grouped by
 * resource and labelled with the role it came from, is what makes an
 * administrator able to answer "why can they do that" without opening every
 * role in turn.
 */
function EffectivePermissionsDialog({
  user,
  onClose,
}: {
  user: User | null;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  const { wildcard, byModule, sourceOf } = useMemo(() => {
    const source = new Map<string, string[]>();
    let star = false;
    for (const role of user?.roles ?? []) {
      for (const code of role.permissions ?? []) {
        if (code === "*") star = true;
        source.set(code, [...(source.get(code) ?? []), role.name]);
      }
    }
    const grouped = new Map<string, string[]>();
    for (const code of source.keys()) {
      if (code === "*") continue;
      const i = code.indexOf(".");
      const mod = i < 0 ? code : code.slice(0, i);
      grouped.set(mod, [...(grouped.get(mod) ?? []), code].sort());
    }
    return {
      wildcard: star,
      byModule: [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)),
      sourceOf: source,
    };
  }, [user]);

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {`${t("users.effective_permissions")}${user ? ` — ${user.fullName}` : ""}`}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{t("users.inherited_hint")}</p>
        {wildcard ? (
          <div className="rounded-md border p-4">
            <Badge className="mb-2">{t("roles.full_access")}</Badge>
            <p className="text-sm text-muted-foreground">{t("users.wildcard_hint")}</p>
          </div>
        ) : byModule.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("users.no_permissions")}</p>
        ) : (
          <div className="space-y-3">
            {byModule.map(([mod, codes]) => (
              <div key={mod} className="rounded-md border p-3">
                <p className="mb-2 text-sm font-semibold capitalize">
                  {mod.replace(/([a-z0-9])([A-Z])/g, "$1 $2")}
                </p>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {codes.map((code) => (
                    <li key={code} className="text-xs">
                      <span className="font-mono">{code}</span>
                      <span className="ms-2 text-muted-foreground">
                        {(sourceOf.get(code) ?? []).join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
