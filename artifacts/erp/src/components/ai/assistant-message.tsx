import { Fragment } from "react";
import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";

/**
 * Render an assistant message as text with clickable in-app navigation links.
 *
 * The Enterprise Assistant is instructed to reference screens as Markdown links
 * with internal paths, e.g. `[Receipts](/receipts)`. We parse only that exact
 * shape and render each as a wouter <Link>; everything else is plain text. We
 * deliberately render ONLY same-origin paths (starting with a single "/") as
 * navigation — never external URLs — so the model cannot surface arbitrary links.
 */
const LINK_RE = /\[([^\]]+)\]\((\/[A-Za-z0-9\-/_]*)\)/g;

export function AssistantMessage({
  content,
  onNavigate,
}: {
  content: string;
  onNavigate?: () => void;
}) {
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
    lastIndex = match.index + full.length;
  }
  if (lastIndex < content.length) {
    nodes.push(<Fragment key={key++}>{content.slice(lastIndex)}</Fragment>);
  }

  return <span className="whitespace-pre-wrap">{nodes}</span>;
}
