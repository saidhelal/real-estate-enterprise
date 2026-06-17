import { Link, useLocation } from "wouter";
import { useLanguage } from "@/lib/language-provider";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowLeft,
  Home as HomeIcon,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
} from "lucide-react";

export type PageNavGroup = {
  titleKey: string;
  items: { href: string; labelKey: string }[];
};

// Authenticated routes that are not part of NAV_GROUPS still get a page crumb.
const FALLBACK_LABELS: Record<string, string> = {
  "/change-password": "nav.change_password",
};

type NavMatch = {
  groupTitleKey: string;
  sectionHref: string;
  labelKey: string;
};

function findNav(path: string, navGroups: PageNavGroup[]): NavMatch | null {
  let best: NavMatch | null = null;
  let bestLen = -1;
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.href === "/") continue;
      if (path === item.href || path.startsWith(item.href + "/")) {
        if (item.href.length > bestLen) {
          bestLen = item.href.length;
          best = {
            groupTitleKey: group.titleKey,
            sectionHref: group.items[0].href,
            labelKey: item.labelKey,
          };
        }
      }
    }
  }
  return best;
}

export function PageNav({ navGroups }: { navGroups: PageNavGroup[] }) {
  const [location, setLocation] = useLocation();
  const { t, dir } = useLanguage();

  // Home is the executive landing / breadcrumb root — no nav bar there.
  if (location === "/") return null;

  const match = findNav(location, navGroups);
  const pageLabelKey = match ? match.labelKey : FALLBACK_LABELS[location];
  const Sep = dir === "rtl" ? ChevronLeft : ChevronRight;
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      // Returning via history preserves the previous screen's state where possible.
      window.history.back();
    } else {
      setLocation(match?.sectionHref && match.sectionHref !== "/" ? match.sectionHref : "/");
    }
  };

  const showSection = !!match && match.sectionHref !== "/";
  const showBackToSection =
    !!match && match.sectionHref !== "/" && match.sectionHref !== location;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
      {/* Breadcrumb */}
      <nav
        aria-label="breadcrumb"
        className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href="/" className="flex items-center gap-1 hover:text-foreground">
          <HomeIcon className="h-3.5 w-3.5" />
          <span>{t("nav.home")}</span>
        </Link>
        {showSection && match && (
          <>
            <Sep className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <Link href={match.sectionHref} className="truncate hover:text-foreground">
              {t(match.groupTitleKey)}
            </Link>
          </>
        )}
        {pageLabelKey && (
          <>
            <Sep className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span className="truncate font-medium text-foreground">{t(pageLabelKey)}</span>
          </>
        )}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleBack} className="gap-1.5">
          <BackIcon className="h-4 w-4" />
          <span>{t("nav.back")}</span>
        </Button>
        {showBackToSection && match && (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={match.sectionHref}>
              <LayoutGrid className="h-4 w-4" />
              <span>{t("nav.back_to_section")}</span>
            </Link>
          </Button>
        )}
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href="/">
            <HomeIcon className="h-4 w-4" />
            <span>{t("nav.home")}</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
