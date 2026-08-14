import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown } from "lucide-react";
import { useLanguage } from "@/lib/language-provider";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * The desktop navigation bar — the sidebar's contents, laid out horizontally.
 *
 * It owns no navigation data. `navGroups` arrives already built from the app's
 * NAV_GROUPS and already filtered by the same permission rules the mobile drawer
 * uses, so the bar, the drawer and the breadcrumb can never disagree about what
 * a user may open. This file is presentation only: it decides how many entries
 * fit and how a menu opens, nothing about what exists.
 *
 * Hidden below `md`, where the drawer remains the right control — a bar of
 * fifteen departments on a phone is a horizontal scroll nobody wants.
 */

type NavItem = { href: string; icon: LucideIcon; labelKey: string };
type NavSubGroup = { titleKey: string; items: NavItem[] };
export type DesktopNavGroup = {
  titleKey: string;
  items: NavItem[];
  subGroups?: NavSubGroup[];
};

/** A bar entry: either a plain link or a group that opens a panel. */
type Entry =
  | { kind: "link"; key: string; labelKey: string; href: string; icon: LucideIcon }
  | { kind: "group"; key: string; labelKey: string; group: DesktopNavGroup };

/**
 * Small groups become individual links rather than a menu holding one or two
 * things — opening a panel to reveal a single destination is a click that buys
 * the reader nothing. Larger groups keep their panel.
 */
const PROMOTE_AT_OR_BELOW = 2;

function buildEntries(navGroups: DesktopNavGroup[]): Entry[] {
  const entries: Entry[] = [];
  for (const group of navGroups) {
    const hasSubs = (group.subGroups?.length ?? 0) > 0;
    if (!hasSubs && group.items.length <= PROMOTE_AT_OR_BELOW) {
      for (const item of group.items) {
        entries.push({
          kind: "link",
          key: item.href,
          labelKey: item.labelKey,
          href: item.href,
          icon: item.icon,
        });
      }
      continue;
    }
    if (group.items.length === 0 && !hasSubs) continue;
    entries.push({ kind: "group", key: group.titleKey, labelKey: group.titleKey, group });
  }
  return entries;
}

function isItemActive(location: string, href: string): boolean {
  return location === href || (href !== "/" && location.startsWith(href + "/"));
}

function isGroupActive(location: string, group: DesktopNavGroup): boolean {
  if (group.items.some((i) => isItemActive(location, i.href))) return true;
  return (group.subGroups ?? []).some((s) => s.items.some((i) => isItemActive(location, i.href)));
}

export function DesktopNav({ navGroups }: { navGroups: DesktopNavGroup[] }) {
  const [location] = useLocation();
  const { t, dir } = useLanguage();

  const entries = buildEntries(navGroups);

  /** Which panel is open, by entry key. `"__more"` is the overflow panel. */
  const [openKey, setOpenKey] = useState<string | null>(null);

  const barRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(entries.length);

  /**
   * Decide how many entries fit.
   *
   * Widths are read from a hidden copy of the full list rather than from the
   * rendered bar: measuring the bar while shrinking it is a feedback loop that
   * oscillates, because removing an entry changes the very width being measured.
   */
  useLayoutEffect(() => {
    const bar = barRef.current;
    const measure = measureRef.current;
    if (!bar || !measure) return;

    const recalc = () => {
      const available = bar.clientWidth;
      const widths = Array.from(measure.children).map(
        (el) => (el as HTMLElement).getBoundingClientRect().width,
      );
      // Reserve room for the "More" trigger from the start, so adding it later
      // can never push the last entry off the edge.
      const moreWidth = widths[widths.length - 1] ?? 0;
      const itemWidths = widths.slice(0, -1);

      let used = 0;
      let fit = 0;
      for (const w of itemWidths) {
        if (used + w > available) break;
        used += w;
        fit++;
      }
      // Everything fits only if the leftovers do too — otherwise the trigger
      // needs its own space.
      if (fit < itemWidths.length) {
        while (fit > 0 && used + moreWidth > available) {
          fit--;
          used -= itemWidths[fit];
        }
      }
      setVisibleCount(fit);
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(bar);
    return () => ro.disconnect();
  }, [entries.length, t]);

  // Close on outside click and on Escape. Both are registered only while a
  // panel is open, so the page carries no listeners at rest.
  useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!barRef.current?.parentElement?.contains(e.target as Node)) setOpenKey(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenKey(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openKey]);

  // A navigation closes whatever opened it.
  useEffect(() => setOpenKey(null), [location]);

  if (entries.length === 0) return null;

  const visible = entries.slice(0, visibleCount);
  const overflow = entries.slice(visibleCount);

  const triggerClass = (active: boolean, open: boolean) =>
    cn(
      "relative inline-flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[13px] font-medium transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
      // A 2px rule under the active entry rather than a filled pill: it marks
      // position without competing with the page beneath it.
      "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors",
      active ? "text-primary after:bg-primary" : "text-muted-foreground after:bg-transparent",
      "hover:text-foreground",
      open && "text-foreground",
    );

  const renderLink = (e: Extract<Entry, { kind: "link" }>) => (
    <Link key={e.key} href={e.href} className={triggerClass(isItemActive(location, e.href), false)}>
      <e.icon className="h-4 w-4 shrink-0" />
      {t(e.labelKey)}
    </Link>
  );

  const renderTrigger = (e: Extract<Entry, { kind: "group" }>) => {
    const open = openKey === e.key;
    return (
      <button
        key={e.key}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpenKey(open ? null : e.key)}
        className={triggerClass(isGroupActive(location, e.group), open)}
      >
        {t(e.labelKey)}
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
    );
  };

  /** Panel body: a flat group is one column list; sub-groups become a mega menu. */
  const renderPanel = (group: DesktopNavGroup) => {
    const subs = group.subGroups ?? [];
    const columns = subs.length > 0;
    return (
      <div className="max-h-[70vh] overflow-y-auto p-4">
        <p className="mb-3 text-eyebrow text-muted-foreground">{t(group.titleKey)}</p>
        {group.items.length > 0 && (
          <ul className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                    "hover:bg-muted hover:text-primary",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isItemActive(location, item.href)
                      ? "bg-muted font-medium text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t(item.labelKey)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {columns && (
          <div className="mt-1 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {subs.map((sub) => (
              <div key={sub.titleKey} className="min-w-0">
                <p className="mb-1 border-b border-border pb-1 text-2xs font-semibold text-foreground">
                  {t(sub.titleKey)}
                </p>
                <ul className="space-y-0.5">
                  {sub.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1 text-[13px] transition-colors",
                          "hover:bg-muted hover:text-primary",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isItemActive(location, item.href)
                            ? "bg-muted font-medium text-primary"
                            : "text-muted-foreground",
                        )}
                      >
                        <item.icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{t(item.labelKey)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const openEntry = entries.find((e) => e.key === openKey && e.kind === "group") as
    | Extract<Entry, { kind: "group" }>
    | undefined;
  const moreOpen = openKey === "__more";

  return (
    // `relative` so the panel can be positioned against the whole bar rather
    // than against one trigger — the panel spans the content width, the way a
    // mega menu should, instead of hanging off whichever word was clicked.
    <div className="relative hidden border-b border-border bg-background md:block">
      <div
        ref={barRef}
        className="mx-auto flex h-[var(--layout-toolbar-height)] w-full max-w-[var(--layout-content-max)] items-stretch px-4 lg:px-6"
      >
        {visible.map((e) => (e.kind === "link" ? renderLink(e) : renderTrigger(e)))}

        {overflow.length > 0 && (
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded={moreOpen}
            onClick={() => setOpenKey(moreOpen ? null : "__more")}
            className={triggerClass(
              overflow.some((e) => (e.kind === "group" ? isGroupActive(location, e.group) : isItemActive(location, e.href))),
              moreOpen,
            )}
          >
            {t("nav.more")}
            <ChevronDown
              className={cn("h-3.5 w-3.5 shrink-0 transition-transform", moreOpen && "rotate-180")}
            />
          </button>
        )}
      </div>

      {/* Hidden width probe: the full list plus the trigger, measured but never
          shown. `inert`-like isolation via aria-hidden + pointer-events-none. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute inset-x-0 top-0 flex h-0 items-stretch overflow-hidden px-4 lg:px-6"
      >
        {entries.map((e) => (
          <span
            key={e.key}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[13px] font-medium"
          >
            {e.kind === "link" && <e.icon className="h-4 w-4 shrink-0" />}
            {t(e.labelKey)}
            {e.kind === "group" && <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
          </span>
        ))}
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[13px] font-medium">
          {t("nav.more")}
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </span>
      </div>

      {(openEntry || moreOpen) && (
        <div
          dir={dir}
          className="absolute inset-x-0 top-full z-30 mx-auto w-full max-w-[var(--layout-content-max)] px-4 lg:px-6"
        >
          <div className="rounded-b-lg border border-t-0 border-border bg-popover text-popover-foreground shadow-lg">
            {openEntry
              ? renderPanel(openEntry.group)
              : /* Overflow: the departments that did not fit, each still able to
                   reach its own screens. */
                <div className="max-h-[70vh] overflow-y-auto p-4">
                  <p className="mb-3 text-eyebrow text-muted-foreground">{t("nav.more")}</p>
                  <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {overflow.map((e) =>
                      e.kind === "link" ? (
                        <Link
                          key={e.key}
                          href={e.href}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-muted hover:text-primary",
                            isItemActive(location, e.href)
                              ? "bg-muted font-medium text-primary"
                              : "text-muted-foreground",
                          )}
                        >
                          <e.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{t(e.labelKey)}</span>
                        </Link>
                      ) : (
                        <div key={e.key} className="min-w-0">
                          <p className="mb-1 border-b border-border pb-1 text-2xs font-semibold text-foreground">
                            {t(e.labelKey)}
                          </p>
                          <ul className="space-y-0.5">
                            {[
                              ...e.group.items,
                              ...(e.group.subGroups ?? []).flatMap((s) => s.items),
                            ].map((item) => (
                              <li key={item.href}>
                                <Link
                                  href={item.href}
                                  className={cn(
                                    "flex items-center gap-2 rounded-md px-2 py-1 text-[13px] transition-colors hover:bg-muted hover:text-primary",
                                    isItemActive(location, item.href)
                                      ? "bg-muted font-medium text-primary"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{t(item.labelKey)}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ),
                    )}
                  </div>
                </div>}
          </div>
        </div>
      )}
    </div>
  );
}
