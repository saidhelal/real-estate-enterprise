import { useState } from "react";
import { useLanguage } from "@/lib/language-provider";
import { 
  useListUsers, 
  useCreateUser, 
  useUpdateUser, 
  useDeleteUser,
  getListUsersQueryKey,
  UserInput,
  UserUpdate,
  User
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
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
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

export default function UsersPage() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const { data: users, isLoading } = useListUsers({ search: search || undefined });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteUser();

  const handleDelete = (id: string) => {
    if (confirm(t("users.delete_confirm"))) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            toast({ title: t("common.deleted") });
            queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
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
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("users.title")}</h2>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
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

      <div className="flex items-center gap-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder={t("common.search")} 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.username")}</TableHead>
              <TableHead>{t("common.email")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">{t("common.loading")}</TableCell>
              </TableRow>
            ) : users?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">{t("common.no_results")}</TableCell>
              </TableRow>
            ) : (
              users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "secondary"}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => setEditingUser(user)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(user.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
