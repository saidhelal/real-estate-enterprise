import { useMemo, useState } from "react";
import {
  useListRoles,
  useListPermissions,
  useUpdateRole,
  getListRolesQueryKey,
  type Role,
  type Permission,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { Toolbar, ToolbarStart, ToolbarEnd } from "@/components/ui/toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { TableFrame } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Grid3x3, Save, RotateCcw, ShieldAlert, Search } from "lucide-react";

/**
 * The permission matrix.
 *
 * Resources down, operations across, one role at a time. It invents nothing:
 * every column is an action that exists in the permission registry, every row
 * a module that registry names, and saving writes through the same role
 * endpoint the role editor uses. If a permission is not in the registry it is
 * not in this grid — the screen is a view onto the RBAC store, not a second
 * store with its own idea of what exists.
 *
 * One role at a time rather than all roles at once is deliberate. A grid of
 * every role against every one of a thousand permissions is not readable, and
 * a bulk save across roles turns one misclick into an estate-wide change.
 */

/** Split `module.action` — the registry's only naming convention. */
function splitCode(code: string): { module: string; action: string } {
  const i = code.indexOf(".");
  return i < 0
    ? { module: code, action: "view" }
    : { module: code.slice(0, i), action: code.slice(i + 1) };
}

/** Turn `salesContracts` into `Sales Contracts` for the row label. */
function humanise(module: string): string {
  return module
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

export default function PermissionMatrixPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: roles, isLoading: rolesLoading } = useListRoles();
  const { data: permissions, isLoading: permsLoading } = useListPermissions();
  const updateRole = useUpdateRole();

  const [roleId, setRoleId] = useState<string>("");
  const [search, setSearch] = useState("");
  /** Pending edits, keyed by permission code. Empty means nothing to save. */
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [reviewOpen, setReviewOpen] = useState(false);

  const role: Role | undefined = useMemo(
    () => roles?.find((r) => r.id === roleId),
    [roles, roleId],
  );

  /**
   * The grid: which modules exist, which actions any of them use, and the
   * exact permission code at each intersection. Built from the registry, so a
   * module that has no `approve` permission simply has no cell there — an
   * empty cell means "this operation does not exist here", which is different
   * from an unchecked box meaning "not granted".
   */
  const { modules, actions, codeAt } = useMemo(() => {
    const byModule = new Map<string, Map<string, string>>();
    const actionSet = new Set<string>();
    for (const p of (permissions ?? []) as Permission[]) {
      const { module, action } = splitCode(p.code);
      actionSet.add(action);
      if (!byModule.has(module)) byModule.set(module, new Map());
      byModule.get(module)!.set(action, p.code);
    }
    // Common operations first so the grid reads left to right in the order
    // people think about them; anything else keeps registry order after.
    const preferred = ["view", "create", "update", "delete", "approve", "export", "print"];
    const rest = [...actionSet].filter((a) => !preferred.includes(a)).sort();
    const ordered = [...preferred.filter((a) => actionSet.has(a)), ...rest];
    return {
      modules: [...byModule.keys()].sort(),
      actions: ordered,
      codeAt: byModule,
    };
  }, [permissions]);

  const isWildcard = !!role?.permissions?.includes("*");

  /** Granted state for a code, taking any pending edit into account. */
  const granted = (code: string): boolean => {
    if (code in pending) return pending[code];
    return !!role?.permissions?.includes(code);
  };

  const toggle = (code: string) => {
    const current = granted(code);
    setPending((p) => {
      const next = { ...p, [code]: !current };
      // A toggle back to the stored value is not a change.
      if (!!role?.permissions?.includes(code) === !current) delete next[code];
      return next;
    });
  };

  const changes = useMemo(() => {
    const added: string[] = [];
    const removed: string[] = [];
    for (const [code, value] of Object.entries(pending)) {
      (value ? added : removed).push(code);
    }
    return { added: added.sort(), removed: removed.sort() };
  }, [pending]);
  const changeCount = changes.added.length + changes.removed.length;

  const visibleModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter(
      (m) => m.toLowerCase().includes(q) || humanise(m).toLowerCase().includes(q),
    );
  }, [modules, search]);

  const handleSave = () => {
    if (!role || changeCount === 0) return;
    const next = new Set(role.permissions ?? []);
    for (const code of changes.added) next.add(code);
    for (const code of changes.removed) next.delete(code);
    updateRole.mutate(
      { id: role.id, data: { permissions: [...next] } },
      {
        onSuccess: () => {
          toast({ title: t("pm.saved") });
          setPending({});
          setReviewOpen(false);
          queryClient.invalidateQueries({ queryKey: getListRolesQueryKey() });
        },
        onError: (err: unknown) => {
          // The server refuses an editor who tries to grant or revoke beyond
          // their own permissions. Surfacing its message verbatim tells the
          // user which code was rejected rather than just "failed".
          toast({
            title: t("pm.refused"),
            description: err instanceof Error ? err.message : undefined,
            variant: "destructive",
          });
        },
      },
    );
  };

  if (rolesLoading || permsLoading) return <LoadingState label={t("common.loading")} />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("nav.permission_matrix")}
        description={t("pm.description")}
        bordered={false}
      />

      <Toolbar>
        <ToolbarStart>
          <Select value={roleId} onValueChange={(v) => { setRoleId(v); setPending({}); }}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder={t("pm.select_role")} />
            </SelectTrigger>
            <SelectContent>
              {roles?.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {role ? (
            <>
              <Badge variant="secondary">
                {`${isWildcard ? modules.length * actions.length : role.permissions.length} ${t("pm.granted")}`}
              </Badge>
              <Badge variant="outline">{`${role.userCount} ${t("roles.users")}`}</Badge>
              {role.isSystem ? <Badge>{t("roles.system")}</Badge> : null}
            </>
          ) : null}
        </ToolbarStart>
        <ToolbarEnd>
          <div className="relative">
            <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="ps-8 w-[220px]"
              placeholder={t("pm.search_resource")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={changeCount === 0}
            onClick={() => setPending({})}
          >
            <RotateCcw className="h-4 w-4 me-1" />
            {t("common.reset")}
          </Button>
          <Button size="sm" disabled={changeCount === 0} onClick={() => setReviewOpen(true)}>
            <Save className="h-4 w-4 me-1" />
            {`${t("pm.review")}${changeCount ? ` (${changeCount})` : ""}`}
          </Button>
        </ToolbarEnd>
      </Toolbar>

      {!role ? (
        <EmptyState
          icon={Grid3x3}
          title={t("pm.no_role_title")}
          description={t("pm.no_role_hint")}
        />
      ) : isWildcard ? (
        <EmptyState
          icon={ShieldAlert}
          title={t("pm.wildcard_title")}
          description={t("pm.wildcard_hint")}
        />
      ) : visibleModules.length === 0 ? (
        <EmptyState icon={Search} title={t("common.no_results")} />
      ) : (
        <TableFrame className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/50">
              <tr>
                <th className="p-3 text-start font-medium min-w-[220px]">{t("pm.resource")}</th>
                {actions.map((a) => (
                  <th key={a} className="p-3 text-center font-medium whitespace-nowrap">
                    {t(`pm.action.${a}`) === `pm.action.${a}` ? humanise(a) : t(`pm.action.${a}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleModules.map((module) => (
                <tr key={module} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{humanise(module)}</td>
                  {actions.map((action) => {
                    const code = codeAt.get(module)?.get(action);
                    if (!code) {
                      return (
                        <td key={action} className="p-3 text-center text-muted-foreground/40">
                          —
                        </td>
                      );
                    }
                    const changed = code in pending;
                    return (
                      <td key={action} className="p-3 text-center">
                        <span className="relative inline-flex">
                          <Checkbox
                            checked={granted(code)}
                            onCheckedChange={() => toggle(code)}
                            aria-label={code}
                          />
                          {changed ? (
                            <span className="absolute -top-1 -end-1 h-2 w-2 rounded-full bg-warning" />
                          ) : null}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      )}

      {/* Changes are shown before they are written — a grid makes it far too
          easy to toggle something and not notice. */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("pm.review_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[50vh] overflow-y-auto">
            {changes.added.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-success">
                  {`${t("pm.will_grant")} (${changes.added.length})`}
                </p>
                <ul className="text-xs font-mono space-y-0.5">
                  {changes.added.map((c) => (
                    <li key={c}>+ {c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {changes.removed.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">
                  {`${t("pm.will_revoke")} (${changes.removed.length})`}
                </p>
                <ul className="text-xs font-mono space-y-0.5">
                  {changes.removed.map((c) => (
                    <li key={c}>− {c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">{t("pm.review_hint")}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={updateRole.isPending}>
              {updateRole.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
