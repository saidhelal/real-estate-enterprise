import { useMemo, useState } from "react";
import {
  useListDelegations,
  getListDelegationsQueryKey,
  useCreateDelegation,
  useActivateDelegation,
  useRevokeDelegation,
  useListDelegatablePermissions,
  getListDelegatablePermissionsQueryKey,
  useListUsers,
  useListCompanies,
  type Delegation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { Toolbar, ToolbarStart, ToolbarEnd } from "@/components/ui/toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableState } from "@/components/ui/states";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableFrame,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StatusTone } from "@/lib/design-tokens";
import { useDeclareScreenContext } from "@/lib/screen-context";
import { ShieldCheck, Plus, Play, Ban, Search } from "lucide-react";

/**
 * Delegations.
 *
 * A delegation hands a named set of permissions to someone else for a fixed
 * period. The picker below offers only what the signed-in user may actually
 * hand over — the server answers that question, so the list here can never
 * invite someone to delegate something that will be refused on save.
 *
 * The server remains the control. Everything this screen does is also checked
 * again on the write path: the codes, the dates, the self-delegation, the
 * overlap. This only avoids wasting the delegator's time.
 */

const STATUS_TONE: Record<string, StatusTone> = {
  draft: "neutral",
  active: "success",
  revoked: "error",
  expired: "warning",
};

export default function DelegationsPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const [statusFilter, setStatusFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<Delegation | null>(null);

  useDeclareScreenContext({
    moduleKey: "generalAdmin",
    documentType: "delegation",
    label: t("nav.delegations"),
  });

  const params = useMemo(
    () => ({ companyId, pageSize: 200, ...(statusFilter === "all" ? {} : { status: statusFilter }) }),
    [companyId, statusFilter],
  );
  const { data, isLoading } = useListDelegations(params, {
    query: { enabled: !!companyId, queryKey: getListDelegationsQueryKey(params) },
  });

  const activate = useActivateDelegation();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getListDelegationsQueryKey(params) });

  const onError = (err: unknown) =>
    toast({
      title: t("dlg.refused"),
      description: err instanceof Error ? err.message : undefined,
      variant: "destructive",
    });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader title={t("nav.delegations")} description={t("dlg.description")} bordered={false} />

      <Toolbar>
        <ToolbarStart>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dlg.all_statuses")}</SelectItem>
              {["draft", "active", "revoked", "expired"].map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`dlg.status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ToolbarStart>
        <ToolbarEnd>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 me-1" />
            {t("dlg.create")}
          </Button>
        </ToolbarEnd>
      </Toolbar>

      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.code")}</TableHead>
              <TableHead>{t("dlg.delegator")}</TableHead>
              <TableHead>{t("dlg.delegate")}</TableHead>
              <TableHead>{t("dlg.scope")}</TableHead>
              <TableHead>{t("dlg.period")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableState colSpan={7} isLoading loadingLabel={t("common.loading")} emptyTitle={t("common.no_results")} />
            ) : (data?.data ?? []).length === 0 ? (
              <TableState
                colSpan={7}
                isEmpty
                emptyTitle={t("dlg.empty")}
                emptyDescription={t("dlg.empty_hint")}
              />
            ) : (
              (data?.data ?? []).map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.code}</TableCell>
                  <TableCell>{d.delegatorName ?? "—"}</TableCell>
                  <TableCell>{d.delegateName ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[280px]">
                      {d.permissions.slice(0, 3).map((c) => (
                        <Badge key={c} variant="secondary" className="font-mono text-[10px]">
                          {c}
                        </Badge>
                      ))}
                      {d.permissions.length > 3 ? (
                        <Badge variant="outline">{`+${d.permissions.length - 3}`}</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{`${d.startDate} → ${d.endDate}`}</TableCell>
                  <TableCell>
                    <StatusBadge
                      tone={STATUS_TONE[d.status] ?? "neutral"}
                      label={t(`dlg.status.${d.status}`)}
                    />
                  </TableCell>
                  <TableCell className="text-end">
                    {d.status === "draft" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={activate.isPending}
                        onClick={() =>
                          activate.mutate(
                            { id: d.id },
                            {
                              onSuccess: () => {
                                toast({ title: t("dlg.activated") });
                                refresh();
                              },
                              onError,
                            },
                          )
                        }
                      >
                        <Play className="h-4 w-4 me-1" />
                        {t("dlg.activate")}
                      </Button>
                    ) : d.status === "active" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setRevoking(d)}
                      >
                        <Ban className="h-4 w-4 me-1" />
                        {t("dlg.revoke")}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {d.revokeReason ?? "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableFrame>

      <CreateDelegationDialog
        open={creating}
        companyId={companyId}
        onClose={() => setCreating(false)}
        onSaved={refresh}
      />
      <RevokeDialog delegation={revoking} onClose={() => setRevoking(null)} onSaved={refresh} />
    </div>
  );
}

function CreateDelegationDialog({
  open,
  companyId,
  onClose,
  onSaved,
}: {
  open: boolean;
  companyId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const create = useCreateDelegation();
  // Exactly what this user may hand over, answered by the server.
  const { data: delegatable } = useListDelegatablePermissions({
    query: { enabled: open, queryKey: getListDelegatablePermissionsQueryKey() },
  });
  const { data: users } = useListUsers();

  const [form, setForm] = useState({
    code: "",
    delegateUserId: "",
    reason: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    notes: "",
  });
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const codes = delegatable?.codes ?? [];
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? codes.filter((c) => c.toLowerCase().includes(q)) : codes;
  }, [codes, search]);

  const toggle = (code: string) =>
    setPicked((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || picked.length === 0) return;
    create.mutate(
      {
        data: {
          companyId,
          code: form.code.trim(),
          delegateUserId: form.delegateUserId,
          permissions: picked,
          reason: form.reason.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          onSaved();
          onClose();
          setPicked([]);
          setForm({
            code: "",
            delegateUserId: "",
            reason: "",
            startDate: new Date().toISOString().slice(0, 10),
            endDate: "",
            notes: "",
          });
          toast({ title: t("dlg.drafted") });
        },
        onError: (err: unknown) =>
          toast({
            title: t("dlg.refused"),
            description: err instanceof Error ? err.message : undefined,
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("dlg.create")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dlg-code">{t("common.code")}</Label>
              <Input id="dlg-code" required value={form.code} onChange={(e) => set("code", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("dlg.delegate")}</Label>
              <Select value={form.delegateUserId} onValueChange={(v) => set("delegateUserId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("dlg.pick_delegate")} />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dlg-start">{t("dlg.start")}</Label>
              <Input
                id="dlg-start"
                type="date"
                required
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dlg-end">{t("dlg.end")}</Label>
              <Input
                id="dlg-end"
                type="date"
                required
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="dlg-reason">{t("dlg.reason")}</Label>
              <Input
                id="dlg-reason"
                required
                value={form.reason}
                onChange={(e) => set("reason", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("dlg.reason_hint")}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{`${t("dlg.scope")} (${picked.length})`}</Label>
              <div className="relative">
                <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="ps-8 w-[200px] h-9"
                  placeholder={t("pm.search_resource")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("dlg.scope_hint")}</p>
            <ScrollArea className="h-[220px] rounded-md border p-3">
              {visible.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("dlg.nothing_delegatable")}</p>
              ) : (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {visible.map((code) => (
                    <label key={code} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={picked.includes(code)} onCheckedChange={() => toggle(code)} />
                      <span className="font-mono text-xs">{code}</span>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dlg-notes">{t("common.notes")}</Label>
            <Textarea
              id="dlg-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || picked.length === 0 || !form.delegateUserId}
            >
              {create.isPending ? t("common.saving") : t("dlg.save_draft")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RevokeDialog({
  delegation,
  onClose,
  onSaved,
}: {
  delegation: Delegation | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const revoke = useRevokeDelegation();
  const [reason, setReason] = useState("");

  return (
    <Dialog open={!!delegation} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {t("dlg.revoke")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("dlg.revoke_hint")}</p>
          <div className="space-y-2">
            <Label htmlFor="dlg-revoke">{t("dlg.revoke_reason")}</Label>
            <Textarea
              id="dlg-revoke"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || revoke.isPending || !delegation}
              onClick={() =>
                delegation &&
                revoke.mutate(
                  { id: delegation.id, data: { revokeReason: reason.trim() } },
                  {
                    onSuccess: () => {
                      toast({ title: t("dlg.revoked") });
                      setReason("");
                      onSaved();
                      onClose();
                    },
                    onError: (err: unknown) =>
                      toast({
                        title: t("dlg.refused"),
                        description: err instanceof Error ? err.message : undefined,
                        variant: "destructive",
                      }),
                  },
                )
              }
            >
              {revoke.isPending ? t("common.saving") : t("dlg.revoke")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
