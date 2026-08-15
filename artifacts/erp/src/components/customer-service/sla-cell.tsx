import { StatusBadge } from "@/components/ui/status-badge";
import { useLanguage } from "@/lib/language-provider";

/**
 * Where a service request stands against its deadline.
 *
 * Complaints, tickets and maintenance requests are all judged against an SLA,
 * and all three would otherwise answer "is this late?" in their own words. One
 * cell means a row reads the same on every screen, and the rule for what
 * counts as late lives beside the rule for how late looks.
 *
 * The server owns the facts — `dueAt` comes from the policy, `escalationLevel`
 * from the breach sweep. This only decides how to show them.
 */

interface SlaCellProps {
  /** The deadline the SLA policy set when the record was created. */
  dueAt?: string | null;
  /** 0 or absent until the sweep raises one. */
  escalationLevel?: string | number | null;
  /** A finished record is not late, however long it took to close. */
  closed?: boolean;
}

/** Hours remaining, or negative when the deadline has passed. */
function hoursUntil(dueAt: string): number {
  return (new Date(dueAt).getTime() - Date.now()) / 3_600_000;
}

export function SlaCell({ dueAt, escalationLevel, closed }: SlaCellProps) {
  const { t } = useLanguage();
  const level = Number(escalationLevel ?? 0) || 0;

  // No policy covers this record, so it promises nothing and cannot be late.
  if (!dueAt) return <span className="text-muted-foreground">—</span>;

  if (closed) {
    return <StatusBadge tone="neutral" label={t("sla.closed")} />;
  }

  const remaining = hoursUntil(dueAt);

  if (remaining < 0) {
    // An escalated breach says how far it has gone; an un-swept one is still
    // simply late, and saying "level 0" would imply a level was assigned.
    return (
      <StatusBadge
        tone="error"
        withDot
        label={level > 0 ? `${t("sla.breached")} · ${t("sla.level")} ${level}` : t("sla.breached")}
      />
    );
  }

  // The last stretch before a deadline is when acting still helps, which is
  // the only reason to distinguish it from comfortably-on-time.
  if (remaining <= 4) {
    return <StatusBadge tone="warning" withDot label={t("sla.due_soon")} />;
  }

  return <StatusBadge tone="success" label={t("sla.on_time")} />;
}
