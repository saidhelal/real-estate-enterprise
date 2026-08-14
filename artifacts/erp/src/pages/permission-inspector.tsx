import { useMemo, useState } from "react";
import {
  useListUsers,
  useInspectUserPermissions,
  getInspectUserPermissionsQueryKey,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { PageHeader } from "@/components/ui/page-header";
import { Toolbar, ToolbarStart } from "@/components/ui/toolbar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { TableFrame } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldQuestion, Search, AlertTriangle } from "lucide-react";

/**
 * The permission inspector.
 *
 * Answers one question the rest of the system cannot: *why* does this person
 * hold this permission. Every code is listed with the role or delegation it
 * came from, so revoking the right thing is a decision rather than a guess —
 * a code granted by two roles does not go away when one of them is removed.
 *
 * Read-only by construction. It changes nothing and owns nothing; the server
 * assembles the answer from the RBAC store and the delegations register.
 */

/** Turn `salesContracts` into `Sales Contracts` for the group heading. */
function humanise(module: string): string {
  return module.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

export default function PermissionInspectorPage() {
  const { t } = useLanguage();
  const { data: users, isLoading: usersLoading } = useListUsers();
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useInspectUserPermissions(userId, {
    query: { enabled: !!userId, queryKey: getInspectUserPermissionsQueryKey(userId) },
  });

  /** Grants grouped by the resource they act on. */
  const byModule = useMemo(() => {
    const q = search.trim().toLowerCase();
    const groups = new Map<string, typeof data extends undefined ? never : NonNullable<typeof data>["grants"]>();
    for (const grant of data?.grants ?? []) {
      if (q && !grant.code.toLowerCase().includes(q)) continue;
      const i = grant.code.indexOf(".");
      const mod = i < 0 ? grant.code : grant.code.slice(0, i);
      groups.set(mod, [...(groups.get(mod) ?? []), grant]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data, search]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("nav.permission_inspector")}
        description={t("pi.description")}
        bordered={false}
      />

      <Toolbar>
        <ToolbarStart>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder={usersLoading ? t("common.loading") : t("pi.pick_user")} />
            </SelectTrigger>
            <SelectContent>
              {(users ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {`${u.fullName} · ${u.username}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data ? (
            <div className="relative">
              <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="ps-8 w-[220px]"
                placeholder={t("pm.search_resource")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          ) : null}
        </ToolbarStart>
      </Toolbar>

      {!userId ? (
        <EmptyState icon={ShieldQuestion} title={t("pi.no_user")} description={t("pi.no_user_hint")} />
      ) : isLoading || !data ? (
        <LoadingState label={t("common.loading")} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("pi.identity")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <Row label={t("common.name")} value={data.fullName} />
                <Row label={t("common.username")} value={data.username} />
                <Row label={t("common.email")} value={data.email ?? "—"} />
                <Row
                  label={t("common.status")}
                  value={
                    <Badge variant={data.isActive ? "secondary" : "outline"}>
                      {data.isActive ? t("common.active") : t("common.inactive")}
                    </Badge>
                  }
                />
                <Row
                  label={t("users.employee")}
                  value={data.employeeId ? t("pi.linked") : t("users.no_employee")}
                />
                <Row
                  label={t("common.company")}
                  value={data.companyId ? t("pi.scoped") : t("pi.unscoped")}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("users.roles")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.wildcard ? (
                  <Badge className="mb-2">{t("roles.full_access")}</Badge>
                ) : null}
                {data.roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("users.no_roles")}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {data.roles.map((r) => (
                      <Badge key={r.id} variant="secondary">
                        {r.name}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="pt-2 text-xs text-muted-foreground">
                  {`${data.grants.length} ${t("pm.granted")}`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t("pi.review")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.riskFlags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("pi.nothing_flagged")}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.riskFlags.map((flag) => (
                      <li key={flag} className="text-sm">
                        <span className="font-medium">{t(`pi.flag.${flag}`)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {/* Flags are observations, not verdicts: each can be entirely
                    legitimate, and the reviewer decides. */}
                <p className="pt-1 text-xs text-muted-foreground">{t("pi.flags_hint")}</p>
              </CardContent>
            </Card>
          </div>

          {data.delegations.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("pi.live_delegations")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.delegations.map((d) => (
                  <div key={d.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{d.code}</span>
                      <Badge variant="outline">{`${d.startDate} → ${d.endDate}`}</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{d.reason}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {d.permissions.map((c) => (
                        <Badge key={c} variant="secondary" className="font-mono text-[10px]">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {data.wildcard ? (
            <EmptyState
              icon={ShieldQuestion}
              title={t("pm.wildcard_title")}
              description={t("pi.wildcard_hint")}
            />
          ) : byModule.length === 0 ? (
            <EmptyState icon={Search} title={t("common.no_results")} />
          ) : (
            <TableFrame className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-start font-medium">{t("pm.resource")}</th>
                    <th className="p-3 text-start font-medium">{t("pi.permission")}</th>
                    <th className="p-3 text-start font-medium">{t("pi.source")}</th>
                  </tr>
                </thead>
                <tbody>
                  {byModule.map(([mod, grants]) =>
                    grants.map((grant, i) => (
                      <tr key={grant.code} className="border-t">
                        {i === 0 ? (
                          <td className="p-3 font-medium align-top" rowSpan={grants.length}>
                            {humanise(mod)}
                          </td>
                        ) : null}
                        <td className="p-3 font-mono text-xs">{grant.code}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            {grant.sources.map((s, k) => (
                              <Badge
                                key={`${s.kind}-${s.label}-${k}`}
                                variant={s.kind === "delegation" ? "default" : "secondary"}
                              >
                                {s.kind === "delegation"
                                  ? `${t("pi.via_delegation")}: ${s.label}${s.expiresOn ? ` · ${s.expiresOn}` : ""}`
                                  : `${t("pi.via_role")}: ${s.label}`}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </TableFrame>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-end">{value}</span>
    </div>
  );
}
