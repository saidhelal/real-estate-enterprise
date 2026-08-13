import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The action bar that sits above a table or list: search and filters at the
 * inline start, view/bulk actions at the inline end.
 *
 * ERP screens live and die by this strip, and it was being rebuilt per page
 * with slightly different heights, gaps and sticky behaviour. One component
 * fixes the row height to --layout-toolbar-height so a table's first row starts
 * at the same offset on every screen.
 */

export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Keeps the bar visible while the table scrolls. Off by default — a sticky
   * element inside an already-scrolling container is a common source of
   * double-scroll bugs, so it must be opted into.
   */
  sticky?: boolean;
  /** Drops the surface background for bars sitting directly on a card. */
  transparent?: boolean;
}

const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  ({ className, sticky = false, transparent = false, children, ...props }, ref) => (
    <div
      ref={ref}
      role="toolbar"
      className={cn(
        "flex flex-wrap items-center gap-2 px-3 py-2",
        "min-h-[var(--layout-toolbar-height)]",
        !transparent && "border-b border-border bg-surface",
        sticky && "sticky top-0 z-20",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
Toolbar.displayName = "Toolbar";

/** Leading cluster — search, filters, scope switches. */
const ToolbarStart = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-2", className)}
    {...props}
  />
));
ToolbarStart.displayName = "ToolbarStart";

/** Trailing cluster — create, export, column settings. */
const ToolbarEnd = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex shrink-0 flex-wrap items-center gap-2", className)}
    {...props}
  />
));
ToolbarEnd.displayName = "ToolbarEnd";

/**
 * Vertical rule between action groups. Uses a logical margin so it stays
 * correctly spaced in both directions.
 */
const ToolbarSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    aria-orientation="vertical"
    className={cn("mx-1 h-5 w-px shrink-0 bg-border", className)}
    {...props}
  />
));
ToolbarSeparator.displayName = "ToolbarSeparator";

/**
 * Contextual bar shown when rows are selected — replaces the normal toolbar
 * content rather than appearing beside it, so the available actions are never
 * ambiguous.
 */
export interface SelectionBarProps extends React.HTMLAttributes<HTMLDivElement> {
  count: number;
  /** Localised label, e.g. `${count} عنصر محدد`. */
  label: React.ReactNode;
  onClear?: () => void;
  clearLabel?: React.ReactNode;
}

const SelectionBar = React.forwardRef<HTMLDivElement, SelectionBarProps>(
  ({ className, count, label, onClear, clearLabel, children, ...props }, ref) => {
    if (count === 0) return null;
    return (
      <div
        ref={ref}
        role="toolbar"
        // aria-live so screen readers announce the selection count changing
        // without the user having to navigate back to the bar.
        aria-live="polite"
        className={cn(
          "flex flex-wrap items-center gap-2 px-3 py-2",
          "min-h-[var(--layout-toolbar-height)]",
          "border-b border-accent-border bg-accent text-accent-foreground",
          className,
        )}
        {...props}
      >
        <span className="text-sm font-medium">{label}</span>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="text-sm underline underline-offset-4 hover:no-underline"
          >
            {clearLabel}
          </button>
        ) : null}
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          {children}
        </div>
      </div>
    );
  },
);
SelectionBar.displayName = "SelectionBar";

export { Toolbar, ToolbarStart, ToolbarEnd, ToolbarSeparator, SelectionBar };
