import { useMemo, useState } from "react";
import { useListCompanies } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { Toolbar, ToolbarStart, ToolbarEnd } from "@/components/ui/toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Inbox, Send, FileEdit, Archive, AlertCircle, Reply, Forward } from "lucide-react";
import {
  useArchive,
  useCompose,
  useCorrespondenceThread,
  useDirectory,
  useForward,
  useMailbox,
  type InternalCorrespondence,
  type MailboxView,
} from "@/lib/correspondence";
import type { StatusTone } from "@/lib/design-tokens";
import { useDeclareScreenContext } from "@/lib/screen-context";

/**
 * Internal correspondence.
 *
 * Every recipient offered here comes from the server's directory, never from a
 * client-side employee list — the picker shows exactly what the server will
 * accept, so a user is never invited to compose something that is then refused
 * on send. The server check remains the control; this only avoids wasting the
 * writer's time.
 */

const VIEWS: Array<{ key: MailboxView; labelKey: string; icon: typeof Inbox }> = [
  { key: "inbox", labelKey: "corr.inbox", icon: Inbox },
  { key: "sent", labelKey: "corr.sent", icon: Send },
  { key: "drafts", labelKey: "corr.drafts", icon: FileEdit },
  { key: "needs_reply", labelKey: "corr.needs_reply", icon: AlertCircle },
  { key: "archived", labelKey: "corr.archived", icon: Archive },
];

const PRIORITY_TONE: Record<string, StatusTone> = {
  urgent: "error",
  high: "warning",
  medium: "neutral",
  normal: "neutral",
  low: "neutral",
};

const KINDS = ["informational", "action_required", "approval", "follow_up"] as const;
const PRIORITIES = ["normal", "medium", "high", "urgent"] as const;

export default function InternalCorrespondencePage() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const [view, setView] = useState<MailboxView>("inbox");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const mailbox = useMailbox({ view, companyId, search: search.trim() || undefined, priority: priority || undefined }, !!companyId);
  const directory = useDirectory(companyId);
  const thread = useCorrespondenceThread(openId);
  const archive = useArchive();

  // The open message is what the header should print. With none open the
  // screen still declares its module, so the print menu offers the
  // correspondence template rather than nothing at all.
  const openRow = (mailbox.data?.data ?? []).find((r) => r.id === openId);
  useDeclareScreenContext({
    moduleKey: "generalAdmin",
    documentType: "correspondence",
    entityId: openId ?? undefined,
    label: openRow?.subject ?? t("corr.title"),
    documentNumber: openRow?.code,
  });

  const nameOf = useMemo(() => {
    const byId = new Map((directory.data?.recipients ?? []).map((e) => [e.id, e.name]));
    if (directory.data?.me) byId.set(directory.data.me.id, directory.data.me.name);
    return (id: string | null | undefined) => (id ? byId.get(id) ?? id.slice(0, 8) : "—");
  }, [directory.data]);

  // A login with no employee record cannot take part; say so plainly rather
  // than showing an empty inbox that looks like a bug.
  const notLinked = (mailbox.error as { status?: number } | null)?.status === 409;

  const rows = mailbox.data?.data ?? [];
  const dateFmt = new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        icon={Inbox}
        title={t("corr.title")}
        bordered={false}
        actions={
          <Button size="sm" onClick={() => setComposeOpen(true)} disabled={notLinked}>
            {t("corr.compose")}
          </Button>
        }
      />

      {notLinked ? (
        <TableFrame>
          <div className="p-6 text-center text-sm text-muted-foreground">{t("corr.not_linked")}</div>
        </TableFrame>
      ) : (
        <TableFrame>
          <Toolbar transparent className="border-b border-border">
            <ToolbarStart>
              {VIEWS.map((v) => (
                <Button
                  key={v.key}
                  size="sm"
                  variant={v.key === view ? "default" : "outline"}
                  className="h-8 gap-1.5"
                  onClick={() => setView(v.key)}
                >
                  <v.icon className="h-3.5 w-3.5" />
                  {t(v.labelKey)}
                </Button>
              ))}
            </ToolbarStart>
            <ToolbarEnd>
              <Input
                className="h-8 w-full sm:max-w-xs"
                placeholder={t("common.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={priority || "__all__"} onValueChange={(v) => setPriority(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-8 w-full sm:w-40">
                  <SelectValue placeholder={t("corr.priority")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("common.all")}</SelectItem>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ToolbarEnd>
          </Toolbar>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("corr.code")}</TableHead>
                <TableHead>{t("corr.subject")}</TableHead>
                <TableHead>{view === "sent" || view === "drafts" ? t("corr.to") : t("corr.from")}</TableHead>
                <TableHead>{t("corr.priority")}</TableHead>
                <TableHead>{t("corr.kind")}</TableHead>
                <TableHead>{t("corr.date")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableState
                colSpan={7}
                isLoading={mailbox.isLoading}
                isError={mailbox.isError && !notLinked}
                isEmpty={rows.length === 0}
                loadingLabel={t("common.loading")}
                emptyTitle={t("common.no_results")}
                errorTitle={t("common.error")}
                onRetry={() => void mailbox.refetch()}
                retryLabel={t("common.retry")}
              />
              {rows.map((r) => {
                const unread =
                  view === "inbox" && r.recipients.some((x) => !x.readAt);
                return (
                  <TableRow key={r.id} className={unread ? "bg-muted/40" : ""}>
                    <TableCell className="font-mono text-2xs">{r.code}</TableCell>
                    <TableCell className={unread ? "font-semibold" : ""}>{r.subject}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {view === "sent" || view === "drafts"
                        ? r.recipients.filter((x) => x.kind === "to").map((x) => nameOf(x.employeeId)).join("، ")
                        : nameOf(r.senderEmployeeId)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={PRIORITY_TONE[r.priority] ?? "neutral"} label={r.priority} withDot />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t(`corr.kind.${r.correspondenceKind ?? "informational"}`)}
                    </TableCell>
                    <TableCell className="text-2xs text-muted-foreground">
                      {r.sentAt ? dateFmt.format(new Date(r.sentAt)) : "—"}
                    </TableCell>
                    <TableCell className="text-end whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => setOpenId(r.id)}>
                        {t("common.open")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          archive.mutate({ id: r.id }, {
                            onSuccess: () => toast({ title: t("corr.archive") }),
                          })
                        }
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableFrame>
      )}

      <ThreadDialog
        openId={openId}
        onClose={() => setOpenId(null)}
        thread={thread.data}
        isLoading={thread.isLoading}
        nameOf={nameOf}
        companyId={companyId}
      />

      <ComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        companyId={companyId}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ThreadDialog({
  openId,
  onClose,
  thread,
  isLoading,
  nameOf,
  companyId,
}: {
  openId: string | null;
  onClose: () => void;
  thread: ReturnType<typeof useCorrespondenceThread>["data"];
  isLoading: boolean;
  nameOf: (id: string | null | undefined) => string;
  companyId?: string;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [replyOpen, setReplyOpen] = useState(false);
  const [forwardTo, setForwardTo] = useState("");
  const directory = useDirectory(companyId);
  const forward = useForward();

  const root = thread?.correspondence;

  return (
    <Dialog open={!!openId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{root?.subject ?? t("corr.thread")}</DialogTitle>
        </DialogHeader>

        {isLoading || !root ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
              <span className="font-mono">{root.code}</span>
              <StatusBadge tone={PRIORITY_TONE[root.priority] ?? "neutral"} label={root.priority} />
              <span>{t(`corr.kind.${root.correspondenceKind ?? "informational"}`)}</span>
            </div>

            {/* Whole conversation, oldest first — a reply is part of the thread,
                never a detached message. */}
            {(thread?.thread ?? [root]).map((m) => (
              <div key={m.id} className="rounded-md border border-border bg-card p-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-2xs text-muted-foreground">
                  <span>
                    {t("corr.from")}: {nameOf(m.senderEmployeeId)}
                  </span>
                  <span>
                    {t("corr.to")}:{" "}
                    {m.recipients.filter((r) => r.kind === "to").map((r) => nameOf(r.employeeId)).join("، ")}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{m.body ?? "—"}</p>
              </div>
            ))}

            {thread?.references?.length ? (
              <div className="text-2xs text-muted-foreground">
                {t("corr.attachments")}: {thread.references.length}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button size="sm" variant="outline" onClick={() => setReplyOpen(true)}>
                <Reply className="me-1.5 h-4 w-4" />
                {t("corr.reply")}
              </Button>
              <Select value={forwardTo} onValueChange={setForwardTo}>
                <SelectTrigger className="h-8 w-56">
                  <SelectValue placeholder={t("corr.forward")} />
                </SelectTrigger>
                <SelectContent>
                  {(directory.data?.recipients ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!forwardTo || forward.isPending}
                onClick={() =>
                  forward.mutate(
                    { id: root.id, data: { to: [forwardTo] } },
                    {
                      onSuccess: () => {
                        toast({ title: t("corr.forward") });
                        setForwardTo("");
                      },
                      onError: () => toast({ title: t("common.error"), variant: "destructive" }),
                    },
                  )
                }
              >
                <Forward className="me-1.5 h-4 w-4" />
                {t("corr.forward")}
              </Button>
            </div>

            {replyOpen && (
              <ComposeForm
                companyId={companyId}
                parentId={root.id}
                defaultTo={root.senderEmployeeId ?? undefined}
                defaultSubject={`RE: ${root.subject}`}
                onDone={() => {
                  setReplyOpen(false);
                  toast({ title: t("corr.reply") });
                }}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */

function ComposeDialog({
  open,
  onClose,
  companyId,
}: {
  open: boolean;
  onClose: () => void;
  companyId?: string;
}) {
  const { t } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("corr.compose")}</DialogTitle>
        </DialogHeader>
        <ComposeForm companyId={companyId} onDone={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function ComposeForm({
  companyId,
  parentId,
  defaultTo,
  defaultSubject,
  onDone,
}: {
  companyId?: string;
  parentId?: string;
  defaultTo?: string;
  defaultSubject?: string;
  onDone: () => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const directory = useDirectory(companyId);
  const compose = useCompose();

  const [to, setTo] = useState(defaultTo ?? "");
  const [subject, setSubject] = useState(defaultSubject ?? "");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [kind, setKind] = useState<string>("informational");

  // Generated once per form instance: a repeated submit — a double click, a
  // retried request — then returns the message that already exists instead of
  // sending official correspondence twice.
  const [idempotencyKey] = useState(
    () => `corr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );

  const recipients = directory.data?.recipients ?? [];
  const canSubmit = !!companyId && subject.trim() !== "" && to !== "";

  const submit = (send: boolean) => {
    if (!companyId) return;
    compose.mutate(
      {
        data: {
          companyId,
          subject: subject.trim(),
          body: body.trim() || undefined,
          priority,
          correspondenceKind: kind,
          to: [to],
          send,
          parentId,
          idempotencyKey: send ? idempotencyKey : undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: send ? t("corr.send") : t("corr.save_draft") });
          onDone();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>{t("corr.to")}</Label>
        {recipients.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("corr.no_recipients")}</p>
        ) : (
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger>
              <SelectValue placeholder={t("corr.pick_recipient")} />
            </SelectTrigger>
            <SelectContent>
              {recipients.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} — {e.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>{t("corr.subject")}</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("corr.priority")}</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("corr.kind")}</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`corr.kind.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t("corr.body")}</Label>
        <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={!canSubmit || compose.isPending} onClick={() => submit(false)}>
          {t("corr.save_draft")}
        </Button>
        <Button size="sm" disabled={!canSubmit || compose.isPending} onClick={() => submit(true)}>
          {t("corr.send")}
        </Button>
      </div>
    </div>
  );
}
