import { useMemo, useState } from "react";
import {
  useListPrParties,
  getListPrPartiesQueryKey,
  useCreatePrParty,
  useUpdatePrParty,
  useListPrInteractions,
  getListPrInteractionsQueryKey,
  useCreatePrInteraction,
  useListCompanies,
  useListEmployees,
  useListCorrespondence,
  getListCorrespondenceQueryKey,
  useListMeetings,
  getListMeetingsQueryKey,
  type PrParty,
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
import { StatusBadge } from "@/components/ui/status-badge";
import { TableState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableFrame,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Checkbox } from "@/components/ui/checkbox";
import { DocumentsRowAction } from "@/components/documents/documents-row-action";
import { useDeclareScreenContext } from "@/lib/screen-context";
import type { StatusTone } from "@/lib/design-tokens";
import { Share2, Plus, Search, Pencil, History, Link2, CalendarClock } from "lucide-react";

/**
 * Public Relations.
 *
 * Two things, kept apart on purpose: the standing relationship with an outside
 * body, and each individual contact with it. The party row answers "who are
 * they, who owns this relationship, when did we last speak"; the interaction
 * log answers "what happened, and did anything come of it".
 *
 * A logged contact can point at the letter, meeting or task it produced. Those
 * are references into the systems that own them — picking a letter here does
 * not copy it, and the letter keeps its own code, status and audit history.
 */

const PARTY_TYPES = [
  "government",
  "company",
  "institution",
  "bank",
  "partner",
  "consultant",
  "media",
  "figure",
] as const;

const RELATIONSHIP_TYPES = [
  "strategic",
  "operational",
  "regulatory",
  "commercial",
  "media",
] as const;

const IMPORTANCE = ["high", "medium", "low"] as const;
const PARTY_STATUS = ["active", "dormant", "suspended", "closed"] as const;
const INTERACTION_TYPES = ["meeting", "call", "letter", "visit", "email", "event"] as const;

const STATUS_TONE: Record<string, StatusTone> = {
  active: "success",
  dormant: "neutral",
  suspended: "warning",
  closed: "neutral",
};

/**
 * An employee's display name.
 *
 * The employee record stores the name in parts, in two scripts. Assembling it
 * here — once — keeps every picker and column in this screen consistent, and
 * falls back across scripts so a record that has only one of them still shows
 * a name rather than a blank.
 */
function personName(e: EmployeeLite | undefined, ar: boolean): string {
  if (!e) return "";
  const arabic = [e.firstNameAr, e.lastNameAr].filter(Boolean).join(" ").trim();
  const latin = [e.firstName, e.lastName].filter(Boolean).join(" ").trim();
  return (ar ? arabic || latin : latin || arabic) || e.code || "";
}

const EMPTY_PARTY = {
  code: "",
  name: "",
  nameAr: "",
  partyType: "company",
  relationshipType: "operational",
  importance: "medium",
  status: "active",
  ownerEmployeeId: "",
  contactPerson: "",
  contactTitle: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  notes: "",
};

export default function PublicRelationsPage() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [importanceFilter, setImportanceFilter] = useState("all");
  const [editing, setEditing] = useState<PrParty | null>(null);
  const [creating, setCreating] = useState(false);
  const [logFor, setLogFor] = useState<PrParty | null>(null);
  const [historyFor, setHistoryFor] = useState<PrParty | null>(null);

  useDeclareScreenContext({
    moduleKey: "generalAdmin",
    documentType: "pr_party",
    label: t("nav.public_relations"),
  });

  const params = useMemo(
    () => ({
      companyId,
      pageSize: 200,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(typeFilter === "all" ? {} : { partyType: typeFilter }),
      ...(importanceFilter === "all" ? {} : { importance: importanceFilter }),
    }),
    [companyId, search, typeFilter, importanceFilter],
  );
  const { data: parties, isLoading } = useListPrParties(params, {
    query: { enabled: !!companyId, queryKey: getListPrPartiesQueryKey(params) },
  });

  const { data: employees } = useListEmployees({ pageSize: 300 });
  const employeeName = (id?: string | null) => {
    if (!id) return null;
    return personName(employees?.data?.find((x) => x.id === id), language === "ar") || null;
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListPrPartiesQueryKey(params) });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("nav.public_relations")}
        description={t("pr.description")}
        bordered={false}
      />

      <Toolbar>
        <ToolbarStart>
          <div className="relative">
            <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="ps-8 w-[220px]"
              placeholder={t("pr.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("pr.all_types")}</SelectItem>
              {PARTY_TYPES.map((v) => (
                <SelectItem key={v} value={v}>
                  {t(`pr.type.${v}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={importanceFilter} onValueChange={setImportanceFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("pr.all_importance")}</SelectItem>
              {IMPORTANCE.map((v) => (
                <SelectItem key={v} value={v}>
                  {t(`pr.importance.${v}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ToolbarStart>
        <ToolbarEnd>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 me-1" />
            {t("pr.add_party")}
          </Button>
        </ToolbarEnd>
      </Toolbar>

      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.code")}</TableHead>
              <TableHead>{t("pr.party")}</TableHead>
              <TableHead>{t("pr.party_type")}</TableHead>
              <TableHead>{t("pr.relationship")}</TableHead>
              <TableHead>{t("pr.owner")}</TableHead>
              <TableHead>{t("pr.last_contact")}</TableHead>
              <TableHead>{t("pr.next_follow_up")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableState colSpan={9} isLoading loadingLabel={t("common.loading")} emptyTitle={t("common.no_results")} />
            ) : (parties?.data ?? []).length === 0 ? (
              <TableState
                colSpan={9}
                isEmpty
                emptyTitle={t("pr.empty")}
                emptyDescription={t("pr.empty_hint")}
              />
            ) : (
              (parties?.data ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.code}</TableCell>
                  <TableCell>
                    <div className="font-medium">{language === "ar" ? (p.nameAr ?? p.name) : p.name}</div>
                    {p.contactPerson ? (
                      <div className="text-xs text-muted-foreground">{p.contactPerson}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>{t(`pr.type.${p.partyType}`)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{t(`pr.relationship.${p.relationshipType}`)}</span>
                      <Badge variant={p.importance === "high" ? "default" : "secondary"}>
                        {t(`pr.importance.${p.importance}`)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{employeeName(p.ownerEmployeeId) ?? "—"}</TableCell>
                  <TableCell>{p.lastContactDate ?? "—"}</TableCell>
                  <TableCell>{p.nextFollowUpDate ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge
                      tone={STATUS_TONE[p.status] ?? "neutral"}
                      label={t(`pr.status.${p.status}`)}
                    />
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setLogFor(p)}>
                        <Plus className="h-4 w-4 me-1" />
                        {t("pr.log")}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setHistoryFor(p)} aria-label={t("pr.history")}>
                        <History className="h-4 w-4" />
                      </Button>
                      <DocumentsRowAction moduleKey="publicRelations" sourceId={p.id} />
                      <Button variant="ghost" size="icon" onClick={() => setEditing(p)} aria-label={t("common.edit")}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableFrame>

      <PartyDialog
        open={creating || !!editing}
        party={editing}
        companyId={companyId}
        employees={employees?.data ?? []}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={refresh}
      />

      <LogInteractionDialog
        party={logFor}
        companyId={companyId}
        employees={employees?.data ?? []}
        onClose={() => setLogFor(null)}
        onSaved={refresh}
      />

      <HistoryDialog party={historyFor} companyId={companyId} onClose={() => setHistoryFor(null)} />
    </div>
  );
}

type EmployeeLite = {
  id: string;
  code?: string;
  firstName?: string;
  lastName?: string;
  firstNameAr?: string | null;
  lastNameAr?: string | null;
};

function PartyDialog({
  open,
  party,
  companyId,
  employees,
  onClose,
  onSaved,
}: {
  open: boolean;
  party: PrParty | null;
  companyId?: string;
  employees: EmployeeLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const create = useCreatePrParty();
  const update = useUpdatePrParty();
  const [form, setForm] = useState<Record<string, string>>(EMPTY_PARTY);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Load the record into the form the first time this dialog opens for it,
  // without a effect that would fight the user's typing on every render.
  const target = party?.id ?? null;
  if (open && loadedFor !== target) {
    setLoadedFor(target);
    setForm(
      party
        ? {
            code: party.code,
            name: party.name,
            nameAr: party.nameAr ?? "",
            partyType: party.partyType,
            relationshipType: party.relationshipType,
            importance: party.importance,
            status: party.status,
            ownerEmployeeId: party.ownerEmployeeId ?? "",
            contactPerson: party.contactPerson ?? "",
            contactTitle: party.contactTitle ?? "",
            phone: party.phone ?? "",
            email: party.email ?? "",
            website: party.website ?? "",
            address: party.address ?? "",
            notes: party.notes ?? "",
          }
        : EMPTY_PARTY,
    );
  }
  if (!open && loadedFor !== null) setLoadedFor(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v.trim()) payload[k] = v.trim();
    }
    const onError = (err: unknown) =>
      toast({
        title: t("common.error"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    const done = () => {
      onSaved();
      onClose();
      toast({ title: party ? t("common.updated") : t("common.created") });
    };
    if (party) {
      update.mutate({ id: party.id, data: payload }, { onSuccess: done, onError });
    } else {
      create.mutate({ data: { ...payload, companyId } as never }, { onSuccess: done, onError });
    }
  };

  const field = (key: string, labelKey: string, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={`pr-${key}`}>{t(labelKey)}</Label>
      <Input id={`pr-${key}`} type={type} value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)} />
    </div>
  );

  const choice = (key: string, labelKey: string, options: readonly string[], prefix: string) => (
    <div className="space-y-2">
      <Label>{t(labelKey)}</Label>
      <Select value={form[key]} onValueChange={(v) => set(key, v)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((v) => (
            <SelectItem key={v} value={v}>
              {t(`${prefix}.${v}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{party ? t("pr.edit_party") : t("pr.add_party")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pr-code">{t("common.code")}</Label>
              <Input
                id="pr-code"
                required
                value={form.code ?? ""}
                onChange={(e) => set("code", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-name">{t("pr.name_en")}</Label>
              <Input
                id="pr-name"
                required
                value={form.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            {field("nameAr", "pr.name_ar")}
            {choice("partyType", "pr.party_type", PARTY_TYPES, "pr.type")}
            {choice("relationshipType", "pr.relationship", RELATIONSHIP_TYPES, "pr.relationship")}
            {choice("importance", "pr.importance_label", IMPORTANCE, "pr.importance")}
            {choice("status", "common.status", PARTY_STATUS, "pr.status")}
            <div className="space-y-2">
              <Label>{t("pr.owner")}</Label>
              <Select
                value={form.ownerEmployeeId || "none"}
                onValueChange={(v) => set("ownerEmployeeId", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("pr.no_owner")}</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {personName(e, language === "ar")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("contactPerson", "pr.contact_person")}
            {field("contactTitle", "pr.contact_title")}
            {field("phone", "cp.phone")}
            {field("email", "cp.email", "email")}
            {field("website", "cp.website")}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pr-address">{t("cp.address")}</Label>
              <Textarea
                id="pr-address"
                rows={2}
                value={form.address ?? ""}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pr-notes">{t("common.notes")}</Label>
              <Textarea
                id="pr-notes"
                rows={3}
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("pr.dates_derived")}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending || !companyId}>
              {create.isPending || update.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Record a contact.
 *
 * The three reference pickers are the point of this dialog: a contact that
 * produced a letter, a meeting or an assignment should say so, and say it by
 * pointing at the actual record rather than restating it in a notes field.
 */
function LogInteractionDialog({
  party,
  companyId,
  employees,
  onClose,
  onSaved,
}: {
  party: PrParty | null;
  companyId?: string;
  employees: EmployeeLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const create = useCreatePrInteraction();
  const [form, setForm] = useState({
    code: "",
    interactionType: "meeting",
    interactionDate: new Date().toISOString().slice(0, 10),
    subject: "",
    handledByEmployeeId: "",
    counterpartName: "",
    purpose: "",
    outcome: "",
    followUpRequired: false,
    followUpDate: "",
    correspondenceId: "",
    meetingId: "",
    notes: "",
  });

  const letterParams = { companyId, pageSize: 100 };
  const { data: letters } = useListCorrespondence(letterParams, {
    query: { enabled: !!party, queryKey: getListCorrespondenceQueryKey(letterParams) },
  });
  const meetingParams = { companyId, pageSize: 100 };
  const { data: meetings } = useListMeetings(meetingParams, {
    query: { enabled: !!party, queryKey: getListMeetingsQueryKey(meetingParams) },
  });

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!party || !companyId) return;
    create.mutate(
      {
        data: {
          companyId,
          partyId: party.id,
          code: form.code.trim(),
          interactionType: form.interactionType,
          interactionDate: form.interactionDate,
          subject: form.subject.trim(),
          followUpRequired: form.followUpRequired,
          ...(form.handledByEmployeeId ? { handledByEmployeeId: form.handledByEmployeeId } : {}),
          ...(form.counterpartName.trim() ? { counterpartName: form.counterpartName.trim() } : {}),
          ...(form.purpose.trim() ? { purpose: form.purpose.trim() } : {}),
          ...(form.outcome.trim() ? { outcome: form.outcome.trim() } : {}),
          ...(form.followUpRequired && form.followUpDate ? { followUpDate: form.followUpDate } : {}),
          ...(form.correspondenceId ? { correspondenceId: form.correspondenceId } : {}),
          ...(form.meetingId ? { meetingId: form.meetingId } : {}),
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPrInteractionsQueryKey() });
          onSaved();
          onClose();
          toast({ title: t("pr.logged") });
        },
        onError: (err: unknown) =>
          toast({
            title: t("common.error"),
            description: err instanceof Error ? err.message : undefined,
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <Dialog open={!!party} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {`${t("pr.log_contact")}${party ? ` — ${language === "ar" ? (party.nameAr ?? party.name) : party.name}` : ""}`}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pri-code">{t("common.code")}</Label>
              <Input
                id="pri-code"
                required
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("pr.interaction_type")}</Label>
              <Select value={form.interactionType} onValueChange={(v) => set("interactionType", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERACTION_TYPES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`pr.interaction.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pri-date">{t("pr.interaction_date")}</Label>
              <Input
                id="pri-date"
                type="date"
                required
                value={form.interactionDate}
                onChange={(e) => set("interactionDate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("pr.handled_by")}</Label>
              <Select
                value={form.handledByEmployeeId || "none"}
                onValueChange={(v) => set("handledByEmployeeId", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("pr.no_owner")}</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {personName(e, language === "ar")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pri-subject">{t("sec.subject")}</Label>
              <Input
                id="pri-subject"
                required
                value={form.subject}
                onChange={(e) => set("subject", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pri-counterpart">{t("pr.counterpart")}</Label>
              <Input
                id="pri-counterpart"
                value={form.counterpartName}
                onChange={(e) => set("counterpartName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pri-purpose">{t("pr.purpose")}</Label>
              <Input
                id="pri-purpose"
                value={form.purpose}
                onChange={(e) => set("purpose", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pri-outcome">{t("pr.outcome")}</Label>
              <Textarea
                id="pri-outcome"
                rows={2}
                value={form.outcome}
                onChange={(e) => set("outcome", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium inline-flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              {t("pr.references")}
            </p>
            <p className="text-xs text-muted-foreground">{t("pr.references_hint")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("sec.kind.correspondence")}</Label>
                <Select
                  value={form.correspondenceId || "none"}
                  onValueChange={(v) => set("correspondenceId", v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("pr.no_reference")}</SelectItem>
                    {(letters?.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {`${c.code} · ${c.subject}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("sec.kind.meeting")}</Label>
                <Select
                  value={form.meetingId || "none"}
                  onValueChange={(v) => set("meetingId", v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("pr.no_reference")}</SelectItem>
                    {(meetings?.data ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {`${m.code} · ${m.title}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="pri-followup"
                checked={form.followUpRequired}
                onCheckedChange={(v) => set("followUpRequired", v === true)}
              />
              <Label htmlFor="pri-followup" className="cursor-pointer inline-flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                {t("pr.follow_up_required")}
              </Label>
            </div>
            {form.followUpRequired ? (
              <div className="space-y-2">
                <Label htmlFor="pri-followup-date">{t("pr.follow_up_date")}</Label>
                <Input
                  id="pri-followup-date"
                  type="date"
                  value={form.followUpDate}
                  onChange={(e) => set("followUpDate", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t("pr.follow_up_hint")}</p>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({
  party,
  companyId,
  onClose,
}: {
  party: PrParty | null;
  companyId?: string;
  onClose: () => void;
}) {
  const { t, language } = useLanguage();
  const params = { companyId, partyId: party?.id, pageSize: 200 };
  const { data, isLoading } = useListPrInteractions(params, {
    query: { enabled: !!party, queryKey: getListPrInteractionsQueryKey(params) },
  });

  return (
    <Dialog open={!!party} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            {`${t("pr.history")}${party ? ` — ${language === "ar" ? (party.nameAr ?? party.name) : party.name}` : ""}`}
          </DialogTitle>
        </DialogHeader>
        <TableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("pr.interaction_type")}</TableHead>
                <TableHead>{t("sec.subject")}</TableHead>
                <TableHead>{t("pr.counterpart")}</TableHead>
                <TableHead>{t("pr.outcome")}</TableHead>
                <TableHead>{t("pr.follow_up")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableState colSpan={6} isLoading loadingLabel={t("common.loading")} emptyTitle={t("common.no_results")} />
              ) : (data?.data ?? []).length === 0 ? (
                <TableState colSpan={6} isEmpty emptyTitle={t("pr.no_history")} />
              ) : (
                (data?.data ?? []).map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.interactionDate}</TableCell>
                    <TableCell>{t(`pr.interaction.${i.interactionType}`)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{i.subject}</div>
                      <div className="text-xs text-muted-foreground font-mono">{i.code}</div>
                    </TableCell>
                    <TableCell>{i.counterpartName ?? "—"}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{i.outcome ?? "—"}</TableCell>
                    <TableCell>
                      {i.followUpRequired ? (
                        <Badge variant="outline">{i.followUpDate ?? t("pr.follow_up_required")}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableFrame>
      </DialogContent>
    </Dialog>
  );
}
