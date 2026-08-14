import { Link } from "wouter";
import {
  useListCompanies,
  useListAdministrativeTasks,
  useListAdministrativeDecisions,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
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
import { Landmark, Briefcase, Inbox, AlertCircle, ClipboardList, Gavel } from "lucide-react";
import { useDirectory, useMailbox } from "@/lib/correspondence";
import type { StatusTone } from "@/lib/design-tokens";

/**
 * The two leadership workspaces.
 *
 * One component, two roles — because the anatomy is identical (who holds the
 * post, what has arrived, what is waiting on them, what they have assigned)
 * and only the emphasis differs. Duplicating it would guarantee the two drift
 * apart the first time either is touched.
 *
 * The distinction the business asked for is in `role`:
 *   chairman           — governance: decisions, strategic approval, oversight
 *   executive_director — operations: assignments, department follow-up
 *
 * Nothing here computes business rules. Every figure comes from an endpoint
 * that already owns it; the page arranges, it does not decide.
 */

type LeadershipRole = "chairman" | "executive_director";

const PRIORITY_TONE: Record<string, StatusTone> = {
  urgent: "error",
  high: "warning",
  medium: "neutral",
  normal: "neutral",
};

const STATUS_TONE: Record<string, StatusTone> = {
  open: "info",
  in_progress: "info",
  completed: "success",
  closed: "success",
  cancelled: "neutral",
  overdue: "error",
};

export function LeadershipWorkspace({ role }: { role: LeadershipRole }) {
  const { t, language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const isChairman = role === "chairman";
  const directory = useDirectory(companyId);

  // The mailboxes the post cares about. Both read the same endpoint the
  // correspondence screen uses — no leadership-only query, no second source.
  const inbox = useMailbox({ view: "inbox", companyId, pageSize: 8 }, !!companyId);
  const needsReply = useMailbox({ view: "needs_reply", companyId, pageSize: 8 }, !!companyId);

  const taskParams = { pageSize: 8 } as const;
  const tasks = useListAdministrativeTasks(taskParams);
  const decisions = useListAdministrativeDecisions(taskParams);

  const holders = isChairman
    ? directory.data?.leadership.chairman
    : directory.data?.leadership.executiveDirector;
  const holderName = holders?.length ? holders.map((h) => h.name).join("، ") : null;

  const inboxRows = inbox.data?.data ?? [];
  const actionRows = needsReply.data?.data ?? [];
  const urgentCount = inboxRows.filter((r) => r.priority === "urgent" || r.priority === "high").length;

  const dateFmt = new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "short",
  });

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        icon={isChairman ? Landmark : Briefcase}
        title={t(isChairman ? "chairman.title" : "exec.title")}
        description={t(isChairman ? "chairman.subtitle" : "exec.subtitle")}
        bordered={false}
        meta={
          holderName ? (
            <StatusBadge tone="info" label={`${t("lead.holder")}: ${holderName}`} />
          ) : (
            // A vacant post is stated, never hidden behind an empty screen —
            // "no holder" is information an operator needs to act on.
            <StatusBadge tone="warning" label={t("lead.post_vacant")} withDot />
          )
        }
        actions={
          <Button asChild size="sm">
            <Link href="/internal-correspondence">{t("lead.open_correspondence")}</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label={t("lead.incoming")}
          value={inbox.data?.total ?? 0}
          icon={Inbox}
          tone="info"
          isLoading={inbox.isLoading}
          href="/internal-correspondence"
        />
        <KpiCard
          label={t("lead.action_required")}
          value={needsReply.data?.total ?? 0}
          icon={AlertCircle}
          tone={actionRows.length > 0 ? "warning" : "neutral"}
          isLoading={needsReply.isLoading}
          href="/internal-correspondence"
        />
        <KpiCard
          label={t("lead.tasks")}
          value={tasks.data?.total ?? 0}
          icon={ClipboardList}
          tone="neutral"
          isLoading={tasks.isLoading}
          href="/administrative-tasks"
        />
        <KpiCard
          label={t("lead.decisions")}
          value={decisions.data?.total ?? 0}
          icon={Gavel}
          tone="neutral"
          isLoading={decisions.isLoading}
          href="/administrative-decisions"
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <MailPanel
          title={t("lead.incoming")}
          rows={inboxRows}
          isLoading={inbox.isLoading}
          isError={inbox.isError}
          dateFmt={dateFmt}
        />
        <MailPanel
          title={t("lead.action_required")}
          rows={actionRows}
          isLoading={needsReply.isLoading}
          isError={needsReply.isError}
          dateFmt={dateFmt}
        />
      </section>

      {/* Governance leans on decisions; operations leans on assignments. Same
          two data sources, ordered by what the post is answerable for. */}
      <section className="grid gap-4 lg:grid-cols-2">
        {(isChairman
          ? ([
              ["lead.decisions", decisions, "/administrative-decisions"],
              ["lead.tasks", tasks, "/administrative-tasks"],
            ] as const)
          : ([
              ["lead.tasks", tasks, "/administrative-tasks"],
              ["lead.decisions", decisions, "/administrative-decisions"],
            ] as const)
        ).map(([labelKey, query, href]) => (
          <Card key={labelKey}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-card-title">
                {t(labelKey)}
                <Button asChild variant="ghost" size="sm">
                  <Link href={href}>{t("common.open")}</Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("corr.subject")}</TableHead>
                    <TableHead>{t("corr.date")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableState
                    colSpan={3}
                    isLoading={query.isLoading}
                    isError={query.isError}
                    isEmpty={(query.data?.data ?? []).length === 0}
                    loadingLabel={t("common.loading")}
                    emptyTitle={t("common.no_results")}
                  />
                  {(query.data?.data ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <StatusBadge
                          tone={STATUS_TONE[String(r.status)] ?? "neutral"}
                          label={String(r.status)}
                          withDot
                        />
                      </TableCell>
                      <TableCell className="truncate">{r.title}</TableCell>
                      <TableCell className="text-2xs text-muted-foreground">
                        {r.dueDate ? dateFmt.format(new Date(String(r.dueDate))) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

function MailPanel({
  title,
  rows,
  isLoading,
  isError,
  dateFmt,
}: {
  title: string;
  rows: ReturnType<typeof useMailbox>["data"] extends infer T
    ? T extends { data: infer R }
      ? R
      : never
    : never;
  isLoading: boolean;
  isError: boolean;
  dateFmt: Intl.DateTimeFormat;
}) {
  const { t } = useLanguage();
  return (
    <TableFrame>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-card-title">{title}</p>
        <Button asChild variant="ghost" size="sm">
          <Link href="/internal-correspondence">{t("common.open")}</Link>
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("corr.priority")}</TableHead>
            <TableHead>{t("corr.subject")}</TableHead>
            <TableHead>{t("corr.date")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableState
            colSpan={3}
            isLoading={isLoading}
            isError={isError}
            isEmpty={rows.length === 0}
            loadingLabel={t("common.loading")}
            emptyTitle={t("common.no_results")}
          />
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <StatusBadge
                  tone={PRIORITY_TONE[r.priority] ?? "neutral"}
                  label={r.priority}
                  withDot
                />
              </TableCell>
              <TableCell className="truncate">{r.subject}</TableCell>
              <TableCell className="text-2xs text-muted-foreground">
                {r.sentAt ? dateFmt.format(new Date(r.sentAt)) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableFrame>
  );
}
