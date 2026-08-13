import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Empty, loading and error states.
 *
 * These three are the most-reinvented surfaces in the app — every list needs
 * all three, and hand-rolling them is why one screen shows a bare "لا توجد
 * بيانات" and the next shows a centred spinner with different spacing. Defining
 * them once also lets each state carry the thing it actually needs: an empty
 * state needs a way out, an error needs a retry, a loading state needs to
 * reserve the layout it is about to fill.
 */

/* ------------------------------------------------------------------------- */
/* Empty                                                                      */
/* ------------------------------------------------------------------------- */

// `title` shadows the native string tooltip attribute; these take content.
export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  /** Say what to do next, not just that the list is empty. */
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Inline variant for empty table bodies and narrow panels. */
  compact?: boolean;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon: Icon, title, description, action, compact = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className,
      )}
      {...props}
    >
      {Icon ? (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-muted text-muted-foreground",
            compact ? "h-9 w-9" : "h-12 w-12",
          )}
        >
          <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </div>
      ) : null}

      <div className="max-w-sm space-y-1">
        <p className={cn("font-semibold", compact ? "text-sm" : "text-base")}>
          {title}
        </p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {action ? <div className="mt-1 flex items-center gap-2">{action}</div> : null}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";

/* ------------------------------------------------------------------------- */
/* Loading                                                                    */
/* ------------------------------------------------------------------------- */

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Shape of the skeleton. `table` and `cards` reserve roughly the space the
   * real content will occupy, which is the point — a spinner that collapses to
   * a full table shifts everything on the page when it resolves.
   */
  variant?: "table" | "cards" | "form" | "inline";
  /** Rows or tiles to draw. */
  count?: number;
  /** Announced to assistive technology while content is pending. */
  label?: string;
}

const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ className, variant = "table", count = 5, label, ...props }, ref) => {
    const rows = Array.from({ length: count });

    return (
      <div
        ref={ref}
        // `busy` + polite so a screen reader announces the wait once rather
        // than reading the placeholder boxes.
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label={label}
        className={cn("w-full", className)}
        {...props}
      >
        {variant === "table" ? (
          <div className="space-y-2">
            {rows.map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 w-24 shrink-0" />
                <Skeleton className="h-8 w-16 shrink-0" />
              </div>
            ))}
          </div>
        ) : null}

        {variant === "cards" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((_, i) => (
              <Skeleton key={i} className="h-[74px] rounded-lg" />
            ))}
          </div>
        ) : null}

        {variant === "form" ? (
          <div className="space-y-4">
            {rows.map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        ) : null}

        {variant === "inline" ? (
          <div className="flex items-center gap-2 py-3">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : null}
      </div>
    );
  },
);
LoadingState.displayName = "LoadingState";

/* ------------------------------------------------------------------------- */
/* Error                                                                      */
/* ------------------------------------------------------------------------- */

export interface ErrorStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  /** What went wrong, in the user's terms. */
  description?: React.ReactNode;
  /**
   * Technical detail — status code, request id. Rendered in a collapsed block
   * so support can read it without it being the first thing the user sees.
   */
  detail?: React.ReactNode;
  detailLabel?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}

const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    {
      className,
      title,
      description,
      detail,
      detailLabel,
      onRetry,
      retryLabel,
      action,
      compact = false,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      // `alert` so the failure is announced immediately — an error the user
      // cannot see is an error they will report as "nothing happened".
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-12",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-destructive-subtle text-destructive-subtle-foreground",
          compact ? "h-9 w-9" : "h-12 w-12",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          className={compact ? "h-4 w-4" : "h-5 w-5"}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 8v5" />
          <path d="M12 16.5h.01" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>

      <div className="max-w-md space-y-1">
        <p className={cn("font-semibold", compact ? "text-sm" : "text-base")}>
          {title}
        </p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {onRetry || action ? (
        <div className="mt-1 flex items-center gap-2">
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}

      {detail ? (
        <details className="mt-2 w-full max-w-md text-start">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            {detailLabel}
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-surface-sunken p-2 text-2xs text-muted-foreground">
            {detail}
          </pre>
        </details>
      ) : null}
    </div>
  ),
);
ErrorState.displayName = "ErrorState";

/* ------------------------------------------------------------------------- */
/* Inside a table                                                             */
/* ------------------------------------------------------------------------- */

export interface TableStateProps {
  /** Must span every column, header actions included, or the row misaligns. */
  colSpan: number;
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  /** Skeleton rows to draw while loading. */
  loadingRows?: number;
  /** Announced while pending. A plain string — it becomes an aria-label. */
  loadingLabel?: string;
  emptyTitle: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  errorTitle?: React.ReactNode;
  errorDescription?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: React.ReactNode;
}

/**
 * The loading / empty / error row of a hand-built table.
 *
 * Around forty tables outside the ResourceManager had each written their own
 * `<TableRow><TableCell colSpan={5} className="text-center h-24">` — which is
 * why a failing request and an empty result looked identical on most of them.
 * This renders the same three states the rest of the app uses, and returns
 * nothing at all once there are rows, so it can sit above `rows.map(...)`.
 *
 * Order matters and is fixed here: loading wins over error, error wins over
 * empty. A failed refetch must never be reported as "no records".
 */
function TableState({
  colSpan,
  isLoading = false,
  isError = false,
  isEmpty = false,
  loadingRows = 5,
  loadingLabel,
  emptyTitle,
  emptyDescription,
  emptyAction,
  errorTitle,
  errorDescription,
  onRetry,
  retryLabel,
}: TableStateProps) {
  if (!isLoading && !isError && !isEmpty) return null;

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className={isLoading ? "p-3" : "p-0"}>
        {isLoading ? (
          <LoadingState variant="table" count={loadingRows} label={loadingLabel} />
        ) : isError ? (
          <ErrorState
            compact
            title={errorTitle ?? emptyTitle}
            description={errorDescription}
            onRetry={onRetry}
            retryLabel={retryLabel}
          />
        ) : (
          <EmptyState
            compact
            icon={Inbox}
            title={emptyTitle}
            description={emptyDescription}
            action={emptyAction}
          />
        )}
      </TableCell>
    </TableRow>
  );
}
TableState.displayName = "TableState";

export { EmptyState, LoadingState, ErrorState, TableState };
