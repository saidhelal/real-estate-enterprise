import { Fragment, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowUpRight,
  BarChart3,
  Search,
  Plus,
  Workflow,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-provider";

/**
 * The Enterprise Assistant can both reference screens inline and PROPOSE
 * concrete ERP actions. Inline references use Markdown links with internal
 * paths, e.g. `[Receipts](/receipts)`. Proposed actions are emitted as fenced
 * code blocks tagged `erp-action` containing one JSON object each.
 *
 * Read-only actions (open/report/search) navigate immediately on click.
 * Data-changing actions (create/workflow) require an explicit confirmation,
 * then route the user to the relevant permission-gated form to finish and save.
 * No write ever happens directly from the assistant — the server forms remain
 * the only place data is mutated, so permissions are always enforced.
 */

type ActionKind = "open" | "report" | "search" | "create" | "workflow";

type ErpAction = {
  kind: ActionKind;
  label: string;
  path: string;
  note?: string;
};

const ACTION_BLOCK_RE = /```erp-action\s*\n([\s\S]*?)```/g;
const INCOMPLETE_BLOCK_RE = /```erp-action[\s\S]*$/;
const LINK_RE = /\[([^\]]+)\]\((\/[^\s)]*)\)/g;

const DATA_CHANGING: ReadonlySet<ActionKind> = new Set<ActionKind>(["create", "workflow"]);

/**
 * Strict same-origin path guard for model-generated navigation targets. Requires
 * exactly one leading slash and an allowlisted character set — this rejects
 * protocol-relative URLs (`//evil.com`), backslash tricks (`/\evil.com`), and
 * scheme injections (`/javascript:...`, the `:` is not permitted), so the
 * assistant can never route the user off-origin or to an executable URI.
 */
function isSafePath(p: unknown): p is string {
  return (
    typeof p === "string" &&
    p.startsWith("/") &&
    !p.startsWith("//") &&
    !p.includes("\\") &&
    /^\/[A-Za-z0-9\-/_?=&%.]*$/.test(p)
  );
}

function parseActions(raw: string): { text: string; actions: ErpAction[] } {
  const actions: ErpAction[] = [];
  let text = raw.replace(ACTION_BLOCK_RE, (_full, body: string) => {
    try {
      const obj = JSON.parse(body.trim()) as Record<string, unknown>;
      const kind = obj.kind as ActionKind;
      if (
        (kind === "open" ||
          kind === "report" ||
          kind === "search" ||
          kind === "create" ||
          kind === "workflow") &&
        typeof obj.label === "string" &&
        isSafePath(obj.path)
      ) {
        actions.push({
          kind,
          label: obj.label,
          path: obj.path,
          note: typeof obj.note === "string" ? obj.note : undefined,
        });
      }
    } catch {
      // ignore malformed action block
    }
    return "";
  });
  // Hide a trailing, not-yet-closed action block while streaming.
  text = text.replace(INCOMPLETE_BLOCK_RE, "");
  return { text: text.trimEnd(), actions };
}

function renderInline(content: string, onNavigate?: () => void): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  LINK_RE.lastIndex = 0;
  while ((match = LINK_RE.exec(content)) !== null) {
    const [full, label, href] = match;
    if (match.index > lastIndex) {
      nodes.push(<Fragment key={key++}>{content.slice(lastIndex, match.index)}</Fragment>);
    }
    if (isSafePath(href)) {
      nodes.push(
        <Link
          key={key++}
          href={href}
          onClick={onNavigate}
          className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary underline-offset-2 hover:underline"
        >
          {label}
          <ArrowUpRight className="h-3 w-3" />
        </Link>,
      );
    } else {
      nodes.push(<Fragment key={key++}>{label}</Fragment>);
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < content.length) {
    nodes.push(<Fragment key={key++}>{content.slice(lastIndex)}</Fragment>);
  }
  return nodes;
}

const KIND_ICON: Record<ActionKind, React.ComponentType<{ className?: string }>> = {
  open: ArrowUpRight,
  report: BarChart3,
  search: Search,
  create: Plus,
  workflow: Workflow,
};

function ActionCard({ action, onNavigate }: { action: ErpAction; onNavigate?: () => void }) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [confirming, setConfirming] = useState(false);
  const Icon = KIND_ICON[action.kind];
  const dataChanging = DATA_CHANGING.has(action.kind);

  function go() {
    onNavigate?.();
    setLocation(action.path);
  }

  function onClick() {
    if (dataChanging && !confirming) {
      setConfirming(true);
      return;
    }
    go();
  }

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">{action.label}</p>
          {action.note && (
            <p className="mt-0.5 text-xs text-muted-foreground">{action.note}</p>
          )}
          {dataChanging && confirming && (
            <p className="mt-1.5 flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("ai.action.confirm_hint")}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        {dataChanging && confirming && (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            {t("ai.action.cancel")}
          </Button>
        )}
        <Button
          size="sm"
          variant={dataChanging && !confirming ? "outline" : "default"}
          onClick={onClick}
          className="gap-1"
        >
          {dataChanging
            ? confirming
              ? t("ai.action.confirm_open")
              : t("ai.action.prepare")
            : t("ai.action.open")}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function AssistantMessage({
  content,
  onNavigate,
}: {
  content: string;
  onNavigate?: () => void;
}) {
  const { actions, text } = parseActions(content);
  return (
    <div className="space-y-2">
      {text && <span className="whitespace-pre-wrap">{renderInline(text, onNavigate)}</span>}
      {actions.length > 0 && (
        <div className="space-y-2 pt-1">
          {actions.map((a, i) => (
            <ActionCard key={i} action={a} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}
