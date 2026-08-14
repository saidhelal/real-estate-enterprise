import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useGetSecretariatOverview,
  getGetSecretariatOverviewQueryKey,
  useListSecretariatFollowUps,
  getListSecretariatFollowUpsQueryKey,
  useListCompanies,
  useCreateCorrespondence,
  getListCorrespondenceQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { Toolbar, ToolbarStart, ToolbarEnd } from "@/components/ui/toolbar";
import { KpiCard } from "@/components/ui/kpi-card";
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
import { useDeclareScreenContext } from "@/lib/screen-context";
import { enumLabel } from "@/lib/enums";
import type { StatusTone } from "@/lib/design-tokens";
import {
  Inbox,
  Send,
  Mail,
  CalendarClock,
  Gavel,
  CheckSquare,
  FileText,
  Plus,
  AlertTriangle,
} from "lucide-react";

/**
 * The secretariat desk.
 *
 * Not a register. Every row shown here belongs to a system that already owns
 * it — correspondence, meetings, decisions, tasks — and every row links back
 * to that system rather than editing a local copy. What this screen adds is
 * the one thing none of them can give on their own: a single dated queue of
 * what is outstanding, sorted by how late it is.
 *
 * The one write it offers is registering incoming or outgoing mail, and even
 * that posts to the correspondence register under `correspondence.create`. The
 * letter gets one code, one row and one audit history whether it is booked in
 * from here or from the correspondence screen.
 */

type FollowUpKind = "task" | "decision" | "meeting" | "correspondence";

/**
 * How each status reads at a glance. The queue mixes four registers, so a
 * status column that coloured each module's vocabulary differently would be
 * unreadable; these are the shared meanings, not per-module ones.
 */
const STATUS_TONE: Record<string, StatusTone> = {
  open: "info",
  in_progress: "info",
  pending: "warning",
  on_hold: "warning",
  scheduled: "info",
  received: "info",
  sent: "neutral",
  replied: "success",
  closed: "success",
  completed: "success",
};

const KIND_META: Record<FollowUpKind, { labelKey: string; icon: typeof Inbox }> = {
  correspondence: { labelKey: "sec.kind.correspondence", icon: Mail },
  meeting: { labelKey: "sec.kind.meeting", icon: CalendarClock },
  decision: { labelKey: "sec.kind.decision", icon: Gavel },
  task: { labelKey: "sec.kind.task", icon: CheckSquare },
};

export default function SecretariatPage() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const [kind, setKind] = useState<string>("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  useDeclareScreenContext({
    moduleKey: "generalAdmin",
    documentType: "correspondence",
    label: t("nav.secretariat"),
  });

  const overviewParams = { companyId };
  const { data: overview, isLoading: overviewLoading } = useGetSecretariatOverview(
    overviewParams,
    {
      query: {
        enabled: !!companyId,
        queryKey: getGetSecretariatOverviewQueryKey(overviewParams),
      },
    },
  );

  const queueParams = useMemo(
    () => ({
      companyId,
      ...(kind === "all" ? {} : { kind }),
      ...(overdueOnly ? { overdueOnly: true } : {}),
      limit: 200,
    }),
    [companyId, kind, overdueOnly],
  );
  const { data: queue, isLoading: queueLoading } = useListSecretariatFollowUps(queueParams, {
    query: { enabled: !!companyId, queryKey: getListSecretariatFollowUpsQueryKey(queueParams) },
  });

  const overdueCount = (queue ?? []).filter((i) => i.overdue).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("nav.secretariat")}
        description={t("sec.description")}
        bordered={false}
      />

      {/* Each tile links to the register that owns the number, so the desk is
          a way in to those systems rather than a dead-end summary. */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight text-muted-foreground">
          {t("sec.section.registers")}
        </h3>
        {overviewLoading || !overview ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg border bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard label={t("sec.kpi.incoming")} value={overview.incomingCount} href="/correspondence" />
            <KpiCard label={t("sec.kpi.outgoing")} value={overview.outgoingCount} href="/correspondence" />
            <KpiCard label={t("sec.kpi.internal")} value={overview.internalCount} href="/internal-correspondence" />
            <KpiCard label={t("sec.kpi.meetings")} value={overview.meetingsScheduled} href="/meetings" />
            <KpiCard label={t("sec.kpi.decisions")} value={overview.openDecisions} href="/administrative-decisions" />
            <KpiCard label={t("sec.kpi.tasks")} value={overview.openTasks} href="/administrative-tasks" />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight text-muted-foreground">
          {t("sec.section.attention")}
        </h3>
        {overviewLoading || !overview ? null : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard label={t("sec.kpi.unread")} value={overview.unreadInternalCount} href="/internal-correspondence" />
            <KpiCard label={t("sec.kpi.awaiting_reply")} value={overview.correspondenceAwaitingReply} />
            <KpiCard label={t("sec.kpi.overdue_tasks")} value={overview.overdueTasks} href="/administrative-tasks" />
            <KpiCard label={t("sec.kpi.overdue_decisions")} value={overview.overdueDecisions} href="/administrative-decisions" />
            <KpiCard label={t("sec.kpi.documents")} value={overview.documentsLinked} />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <Toolbar>
          <ToolbarStart>
            <h3 className="text-sm font-semibold tracking-tight">{t("sec.section.queue")}</h3>
            {overdueCount > 0 ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {`${overdueCount} ${t("sec.overdue")}`}
              </Badge>
            ) : null}
          </ToolbarStart>
          <ToolbarEnd>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("sec.kind.all")}</SelectItem>
                {(Object.keys(KIND_META) as FollowUpKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(KIND_META[k].labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={overdueOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setOverdueOnly((v) => !v)}
            >
              <AlertTriangle className="h-4 w-4 me-1" />
              {t("sec.overdue_only")}
            </Button>
            <Button size="sm" onClick={() => setRegisterOpen(true)}>
              <Plus className="h-4 w-4 me-1" />
              {t("sec.register_mail")}
            </Button>
          </ToolbarEnd>
        </Toolbar>

        <TableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("sec.col.kind")}</TableHead>
                <TableHead>{t("common.code")}</TableHead>
                <TableHead>{t("common.title")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("sec.col.due")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queueLoading ? (
                <TableState colSpan={6} isLoading loadingLabel={t("common.loading")} emptyTitle={t("common.no_results")} />
              ) : (queue ?? []).length === 0 ? (
                <TableState
                  colSpan={6}
                  isEmpty
                  emptyTitle={t("sec.queue_empty")}
                  emptyDescription={t("sec.queue_empty_hint")}
                />
              ) : (
                (queue ?? []).map((item) => {
                  const meta = KIND_META[item.kind as FollowUpKind];
                  const Icon = meta?.icon ?? FileText;
                  return (
                    <TableRow key={`${item.kind}-${item.id}`}>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {meta ? t(meta.labelKey) : item.kind}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.code}</TableCell>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>
                        <StatusBadge
                          tone={STATUS_TONE[item.status] ?? "neutral"}
                          label={enumLabel(item.status, language)}
                        />
                      </TableCell>
                      <TableCell>
                        <span className={item.overdue ? "text-destructive font-medium" : ""}>
                          {item.dueDate ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-end">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={item.href}>{t("sec.open")}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableFrame>
      </section>

      <RegisterMailDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        companyId={companyId}
        onDone={() => {
          queryClient.invalidateQueries({ queryKey: getGetSecretariatOverviewQueryKey(overviewParams) });
          queryClient.invalidateQueries({ queryKey: getListSecretariatFollowUpsQueryKey(queueParams) });
          queryClient.invalidateQueries({ queryKey: getListCorrespondenceQueryKey() });
          toast({ title: t("sec.registered") });
        }}
      />
    </div>
  );
}

/**
 * Book a letter in or out.
 *
 * Posts straight to the correspondence register. There is no secretariat copy
 * of the letter and no second numbering scheme — this is the same create the
 * correspondence screen performs, offered where the work actually happens.
 */
function RegisterMailDialog({
  open,
  onOpenChange,
  companyId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId?: string;
  onDone: () => void;
}) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const create = useCreateCorrespondence();
  const [form, setForm] = useState({
    direction: "incoming",
    code: "",
    subject: "",
    senderName: "",
    recipientName: "",
    refNumber: "",
    priority: "medium",
    replyDueDate: "",
    body: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const incoming = form.direction === "incoming";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    create.mutate(
      {
        data: {
          companyId,
          code: form.code.trim(),
          direction: form.direction,
          subject: form.subject.trim(),
          priority: form.priority,
          status: incoming ? "received" : "sent",
          ...(form.senderName.trim() ? { senderName: form.senderName.trim() } : {}),
          ...(form.recipientName.trim() ? { recipientName: form.recipientName.trim() } : {}),
          ...(form.refNumber.trim() ? { refNumber: form.refNumber.trim() } : {}),
          ...(form.replyDueDate ? { replyDueDate: form.replyDueDate } : {}),
          ...(form.body.trim() ? { body: form.body.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setForm({
            direction: "incoming",
            code: "",
            subject: "",
            senderName: "",
            recipientName: "",
            refNumber: "",
            priority: "medium",
            replyDueDate: "",
            body: "",
          });
          onDone();
        },
        onError: (err: unknown) => {
          toast({
            title: t("common.error"),
            description: err instanceof Error ? err.message : undefined,
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("sec.register_mail")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("sec.direction")}</Label>
              <Select value={form.direction} onValueChange={(v) => set("direction", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incoming">
                    <span className="inline-flex items-center gap-2">
                      <Inbox className="h-4 w-4" />
                      {t("sec.incoming")}
                    </span>
                  </SelectItem>
                  <SelectItem value="outgoing">
                    <span className="inline-flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      {t("sec.outgoing")}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sec-code">{t("common.code")}</Label>
              <Input
                id="sec-code"
                required
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sec-subject">{t("sec.subject")}</Label>
              <Input
                id="sec-subject"
                required
                value={form.subject}
                onChange={(e) => set("subject", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sec-party">{incoming ? t("sec.sender") : t("sec.recipient")}</Label>
              <Input
                id="sec-party"
                value={incoming ? form.senderName : form.recipientName}
                onChange={(e) => set(incoming ? "senderName" : "recipientName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sec-ref">{t("sec.ref_number")}</Label>
              <Input
                id="sec-ref"
                value={form.refNumber}
                onChange={(e) => set("refNumber", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("common.priority")}</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Priority wording comes from the shared enum catalogue, so
                      it reads the same here as on every other screen. */}
                  {["low", "medium", "high"].map((v) => (
                    <SelectItem key={v} value={v}>
                      {enumLabel(v, language)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sec-due">{t("sec.reply_due")}</Label>
              <Input
                id="sec-due"
                type="date"
                value={form.replyDueDate}
                onChange={(e) => set("replyDueDate", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("sec.reply_due_hint")}</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sec-body">{t("sec.body")}</Label>
              <Textarea
                id="sec-body"
                rows={4}
                value={form.body}
                onChange={(e) => set("body", e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending || !companyId}>
              {create.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
