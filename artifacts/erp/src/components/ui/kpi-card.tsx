import * as React from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/design-tokens";

/**
 * The metric tile used across dashboards.
 *
 * One implementation for every KPI on every screen: the label size, the value
 * weight, the icon plate and the loading skeleton are decided here, so two
 * dashboards cannot drift apart. `StatCard` is a thin wrapper over this.
 *
 * The value uses tabular figures — a metric that changes on refresh must not
 * make the surrounding layout jitter as digit widths change.
 */

/**
 * The icon chip is the tile's entire colour budget: a small SOLID plate with a
 * white glyph, never a tinted wash and never a fill on the card itself. A
 * washed chip disappears against a white card at tile size, which is why the
 * whole KPI row used to read as one grey block.
 *
 * `neutral` stays soft on purpose — a count that carries no judgement should
 * not be dressed in a saturated plate just to look consistent.
 */
const TONE_PLATE: Record<StatusTone | "brand", string> = {
  brand: "bg-primary text-primary-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  error: "bg-destructive text-destructive-foreground",
  info: "bg-info text-info-foreground",
  neutral: "bg-muted text-muted-foreground",
};

export type KpiTrendDirection = "up" | "down" | "flat";

/**
 * Whether a rise is good news. Cost and overdue metrics invert, so the caller
 * declares intent rather than the component assuming up-is-green.
 */
export type KpiTrendPolarity = "positive-up" | "positive-down";

export interface KpiTrend {
  direction: KpiTrendDirection;
  /** Pre-formatted and localised by the caller, e.g. "12.4%+". */
  label: React.ReactNode;
  polarity?: KpiTrendPolarity;
}

export interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: StatusTone | "brand";
  trend?: KpiTrend;
  /** Secondary context under the value — comparison period, target, unit. */
  hint?: React.ReactNode;
  isLoading?: boolean;
  /** Renders as a button and exposes keyboard focus when the tile drills down. */
  onActivate?: () => void;
  /**
   * Force the interactive treatment when the tile is wrapped in something else
   * that handles activation. Implied by `onActivate` and by `href`, so it is
   * only needed when something outside handles the click.
   */
  interactive?: boolean;
  /**
   * Drill-down target. Renders the tile inside a real link, so middle-click and
   * open-in-new-tab work — which `onActivate` cannot give you. Four dashboards
   * had each written this wrapper by hand; it belongs here instead.
   */
  href?: string;
  /** Vertical layout with a larger value, for a hero metric. */
  emphasis?: boolean;
}

function trendClass(trend: KpiTrend): string {
  if (trend.direction === "flat") return "text-muted-foreground";
  const goodWhenUp = (trend.polarity ?? "positive-up") === "positive-up";
  const isGood = trend.direction === "up" ? goodWhenUp : !goodWhenUp;
  return isGood ? "text-success" : "text-destructive";
}

function TrendGlyph({ direction }: { direction: KpiTrendDirection }) {
  // Inline SVG rather than an icon dependency: three shapes, drawn from
  // currentColor, and aria-hidden because the adjacent label carries the
  // meaning for assistive technology.
  const d =
    direction === "up"
      ? "M3 9.5 7 5.5l3 3 4-4"
      : direction === "down"
        ? "M3 5.5 7 9.5l3-3 4 4"
        : "M3 7.5h11";
  return (
    <svg
      viewBox="0 0 17 15"
      className="h-3 w-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const KpiCard = React.forwardRef<HTMLDivElement, KpiCardProps>(
  (
    {
      className,
      label,
      value,
      icon: Icon,
      tone = "neutral",
      trend,
      hint,
      isLoading = false,
      onActivate,
      interactive,
      href,
      emphasis = false,
      ...props
    },
    ref,
  ) => {
    const activates = typeof onActivate === "function";
    const looksInteractive = interactive ?? (activates || href !== undefined);

    const tile = (
      <Card
        ref={ref}
        // The hover/active/focus treatment lives in `Card`, so a metric tile
        // and a module tile cannot end up feeling different under the cursor.
        interactive={looksInteractive}
        {...(activates
          ? {
              role: "button",
              tabIndex: 0,
              onClick: onActivate,
              onKeyDown: (e: React.KeyboardEvent) => {
                // Space and Enter both activate, matching native button
                // behaviour — a div with role="button" gets neither for free.
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onActivate();
                }
              },
            }
          : {})}
        className={cn("overflow-hidden", className)}
        {...props}
      >
        <CardContent
          className={cn(
            "p-3",
            emphasis ? "flex flex-col gap-2" : "flex items-center gap-3",
          )}
        >
          {Icon ? (
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-md shadow-sm",
                TONE_PLATE[tone],
                emphasis ? "h-8 w-8" : "h-9 w-9",
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-muted-foreground">
              {label}
            </p>

            {isLoading ? (
              <Skeleton className="mt-1.5 h-5 w-20" />
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span
                  className={cn(
                    "font-semibold leading-tight",
                    emphasis ? "text-kpi" : "text-lg",
                  )}
                  data-numeric=""
                >
                  {value ?? "—"}
                </span>
                {trend ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium",
                      trendClass(trend),
                    )}
                  >
                    <TrendGlyph direction={trend.direction} />
                    {trend.label}
                  </span>
                ) : null}
              </div>
            )}

            {hint && !isLoading ? (
              <p className="mt-0.5 truncate text-2xs text-muted-foreground">
                {hint}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );

    // The link owns focus and the focus ring; the card owns the surface. They
    // share a radius so the ring does not cut the corners.
    return href ? (
      <Link
        href={href}
        className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {tile}
      </Link>
    ) : (
      tile
    );
  },
);
KpiCard.displayName = "KpiCard";

export { KpiCard };
