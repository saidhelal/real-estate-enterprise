import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The standard header for every screen: breadcrumb, title, optional subtitle
 * and status, and a right-aligned action group.
 *
 * Exists so screens stop assembling their own heading out of ad-hoc
 * `text-2xl font-bold` and inconsistent spacing. One component means the title
 * size, the gap under the breadcrumb and the action alignment are decided once.
 *
 * Direction-agnostic: actions sit at the inline end, so they are on the left in
 * Arabic and on the right in English with no per-locale branching.
 */

// `title` is omitted from the DOM attributes: the native one is a string
// tooltip, and this component's title is renderable content.
export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Rendered above the title — pass the existing Breadcrumb component. */
  breadcrumb?: React.ReactNode;
  title: React.ReactNode;
  /**
   * Optional glyph before the title, for screens whose identity is the icon as
   * much as the words. Decorative: the title already names the screen, so it is
   * hidden from assistive technology.
   */
  icon?: React.ComponentType<{ className?: string }>;
  /** One line of context. Keep it short; it is not a place for help text. */
  description?: React.ReactNode;
  /** Status badges or counts shown inline after the title. */
  meta?: React.ReactNode;
  /** Primary and secondary actions. Order them primary-last in RTL reading. */
  actions?: React.ReactNode;
  /** Removes the bottom border when the page supplies its own separator. */
  bordered?: boolean;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  (
    {
      className,
      breadcrumb,
      title,
      icon: Icon,
      description,
      meta,
      actions,
      bordered = true,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-2 pb-4",
        bordered && "border-b border-border",
        className,
      )}
      {...props}
    >
      {breadcrumb ? <div className="min-w-0">{breadcrumb}</div> : null}

      {/* Wraps to two rows on narrow viewports instead of squeezing the title. */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {Icon ? (
              <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            ) : null}
            <h1 className="text-page-title min-w-0 truncate">{title}</h1>
            {meta}
          </div>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  ),
);
PageHeader.displayName = "PageHeader";

export { PageHeader };
