import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";
import { useAuth } from "@/lib/auth-provider";
import { filterNavGroups, navSectionsFor } from "@/components/layout/app-shell";
import { accentBarClass, accentChipClass, accentSurfaceClass } from "@/lib/design-tokens";

/**
 * A department's sections, as cards, taken from the navigation SSOT.
 *
 * Department landing pages used to carry their own list of what the
 * department contains — the same hrefs, labels and icons the navigation
 * already declared, written a second time. Two lists of the same thing drift:
 * a screen added to the menu never appeared on the page, and a card could
 * point at a screen the menu had already dropped.
 *
 * So there is no list here. The component asks the navigation for the
 * department's sections and renders whatever it gets, already filtered by the
 * same permissions the menu applies. Adding a screen to the SSOT makes it
 * appear in the bar, the drawer and on the department page at once.
 */

export interface DepartmentSectionsProps {
  /** The department's group key in the navigation SSOT. */
  groupTitleKey: string;
  /**
   * Screens that are the department's own front door rather than part of its
   * contents — its dashboard, typically. Listed on the page would be a card
   * that navigates to the page you are already on.
   */
  excludeHrefs?: string[];
  /** Accent per section index, so a department reads as one colour family. */
  accentFor?: (sectionIndex: number) => number;
}

export function DepartmentSections({
  groupTitleKey,
  excludeHrefs = [],
  accentFor,
}: DepartmentSectionsProps) {
  const { t } = useLanguage();
  const { user } = useAuth();

  // Home is the root every department hangs off, never one of its functions —
  // a card leading back out of the department reads as a mistake. The
  // breadcrumb skips it for the same reason.
  const skip = new Set([...excludeHrefs, "/"]);
  const sections = navSectionsFor(filterNavGroups(user), groupTitleKey)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !skip.has(item.href)),
    }))
    .filter((section) => section.items.length > 0);

  if (sections.length === 0) return null;

  // A department with one unnamed section is a flat list; repeating the
  // department's own name above it would say nothing.
  const showHeadings = sections.length > 1 || sections[0].titleKey !== groupTitleKey;

  return (
    <div className="space-y-6">
      {sections.map((section, sectionIndex) => {
        const accent = accentFor ? accentFor(sectionIndex) : sectionIndex % 8;
        return (
          <section key={section.titleKey} className="space-y-3">
            {showHeadings ? (
              <h3 className="text-sm font-semibold tracking-tight text-muted-foreground">
                {t(section.titleKey)}
              </h3>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Card
                    interactive
                    className={`relative flex h-full flex-col gap-2 overflow-hidden p-3 ${accentSurfaceClass(accent)}`}
                  >
                    <span
                      aria-hidden
                      className={`absolute inset-y-0 start-0 w-1 transition-all group-hover:w-1.5 ${accentBarClass(accent)}`}
                    />
                    <div className="flex items-start gap-2.5 ps-1.5">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md shadow-sm ${accentChipClass(accent)}`}
                      >
                        <item.icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-semibold leading-tight text-foreground">
                        {t(item.labelKey)}
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
