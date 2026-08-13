import * as React from "react";
import { cn } from "@/lib/utils";
import { STATUS_TOKENS, type StatusTone } from "@/lib/design-tokens";

/**
 * The single place a status turns into a colour.
 *
 * Statuses were being coloured at each call site, so the same value could read
 * green on one screen and grey on the next, and a reader had to learn the
 * palette per page. Routing every status through one component makes the
 * mapping a property of the system rather than of whoever wrote the screen.
 *
 * It carries no business knowledge: it does not know that `posted` is good or
 * that `returned` is bad. The caller supplies the tone, because only the owning
 * module knows what a status means — an overdue installment is bad, an overdue
 * *filter* is neutral. The component only guarantees that a given tone looks
 * identical everywhere.
 *
 * Colours come from `STATUS_TOKENS`, which resolves to the CSS tokens in
 * `index.css`. No hex, no palette utility, nothing to drift.
 */

export type StatusVariant = "subtle" | "solid";

export interface StatusBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Semantic meaning. The owning module decides which status maps to which. */
  tone?: StatusTone;
  /**
   * `subtle` (default) is the list/table treatment — readable in a dense row
   * without pulling the eye off the data. `solid` is for the few places a
   * status is the headline, such as a workspace header.
   */
  variant?: StatusVariant;
  /** Already-localised text. Never localise inside this component. */
  label: React.ReactNode;
  /** Optional leading dot, for scanning a column of statuses vertically. */
  withDot?: boolean;
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, tone = "neutral", variant = "subtle", label, withDot = false, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border",
        "px-2 py-0.5 text-xs font-medium",
        STATUS_TOKENS[tone][variant],
        className,
      )}
      {...props}
    >
      {withDot ? (
        // Redundant with colour on purpose: colour alone is not an accessible
        // signal, and the dot survives greyscale printing and export.
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70"
        />
      ) : null}
      {label}
    </span>
  ),
);
StatusBadge.displayName = "StatusBadge";

export { StatusBadge };
