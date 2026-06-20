import { useMemo, useState } from "react";
import {
  useListLeads,
  useCreateLeadAssignment,
  getListLeadsQueryKey,
  useListBranches,
  useListUsers,
  useListCompanies,
  type Lead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-provider";

export default function LeadAssignmentsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const createAssignment = useCreateLeadAssignment();

  const [search, setSearch] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [branchId, setBranchId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  const { data: companies } = useListCompanies();
  const { data: branches } = useListBranches();
  const { data: users } = useListUsers();
  const companyId = companies?.[0]?.id;

  const { data: leadsResp } = useListLeads(
    {
      pageSize: 200,
      ...(search ? { search } : {}),
      ...(unassignedOnly ? { unassigned: "true" } : {}),
    },
    {
      query: {
        queryKey: getListLeadsQueryKey({
          pageSize: 200,
          ...(search ? { search } : {}),
          ...(unassignedOnly ? { unassigned: "true" } : {}),
        }),
      },
    },
  );

  const leads = useMemo(() => leadsResp?.data ?? [], [leadsResp]);
  const userName = (id?: string | null) =>
    id ? users?.find((u) => u.id === id)?.fullName ?? users?.find((u) => u.id === id)?.username ?? id : null;

  const selectedIds = useMemo(
    () => leads.filter((l) => selected[l.id]).map((l) => l.id),
    [leads, selected],
  );
  const allChecked = leads.length > 0 && leads.every((l) => selected[l.id]);

  function toggleAll(checked: boolean) {
    const next: Record<string, boolean> = {};
    if (checked) for (const l of leads) next[l.id] = true;
    setSelected(next);
  }

  async function assign(ids: string[]) {
    if (!companyId) return;
    if (!userId) {
      toast({ title: t("assign.pick_user"), variant: "destructive" });
      return;
    }
    if (ids.length === 0) {
      toast({ title: t("assign.pick_rows"), variant: "destructive" });
      return;
    }
    setAssigning(true);
    let ok = 0;
    for (const leadId of ids) {
      try {
        await createAssignment.mutateAsync({
          data: {
            companyId,
            leadId,
            assignedToUserId: userId,
            ...(branchId ? { branchId } : {}),
            ...(user?.id ? { assignedByUserId: user.id } : {}),
          },
        });
        ok += 1;
      } catch {
        // continue; failures are reflected in the remaining unassigned list
      }
    }
    await queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
    setSelected({});
    setAssigning(false);
    toast({ title: t("assign.assigned_done"), description: `${ok}/${ids.length}` });
  }

  const branchOptions = branches ?? [];
  const userOptions = users ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("assign.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2 space-y-2">
              <Label>{t("common.search")}</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("assign.search_placeholder")}
                data-testid="input-assign-search"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("assign.branch")}</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger data-testid="select-assign-branch">
                  <SelectValue placeholder={t("assign.select_branch")} />
                </SelectTrigger>
                <SelectContent>
                  {branchOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("assign.sales_user")}</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger data-testid="select-assign-user">
                  <SelectValue placeholder={t("assign.select_user")} />
                </SelectTrigger>
                <SelectContent>
                  {userOptions.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName ?? u.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="unassigned-only"
                checked={unassignedOnly}
                onCheckedChange={(v) => {
                  setUnassignedOnly(v);
                  setSelected({});
                }}
                data-testid="switch-unassigned-only"
              />
              <Label htmlFor="unassigned-only">{t("assign.unassigned_only")}</Label>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} {t("assign.selected_count")}
              </span>
              <Button
                onClick={() => assign(selectedIds)}
                disabled={assigning || selectedIds.length === 0}
                data-testid="button-assign-selected"
              >
                {t("assign.assign_selected")}
              </Button>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={(v) => toggleAll(Boolean(v))}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>{t("assign.code")}</TableHead>
                  <TableHead>{t("assign.name")}</TableHead>
                  <TableHead>{t("assign.mobile")}</TableHead>
                  <TableHead>{t("assign.national_id")}</TableHead>
                  <TableHead>{t("assign.current_assignee")}</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {t("assign.no_leads")}
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((l: Lead) => (
                    <TableRow key={l.id} data-testid={`row-lead-${l.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={Boolean(selected[l.id])}
                          onCheckedChange={(v) =>
                            setSelected((s) => ({ ...s, [l.id]: Boolean(v) }))
                          }
                          data-testid={`checkbox-lead-${l.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{l.code}</TableCell>
                      <TableCell>{l.fullName}</TableCell>
                      <TableCell>{l.phone ?? "-"}</TableCell>
                      <TableCell>{l.nationalId ?? "-"}</TableCell>
                      <TableCell>
                        {l.assignedToUserId ? (
                          userName(l.assignedToUserId)
                        ) : (
                          <Badge variant="secondary">{t("assign.unassigned")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => assign([l.id])}
                          disabled={assigning}
                          data-testid={`button-assign-${l.id}`}
                        >
                          {t("assign.assign")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
