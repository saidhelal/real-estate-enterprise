import { Link, useRoute } from "wouter";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-provider";
import { navGroupTitleKeyForSlug } from "@/components/layout/app-shell";
import { DepartmentSections } from "@/components/layout/department-sections";

/**
 * A department's workspace: the one screen that shows what a department is
 * made of.
 *
 * There is one of these for every department, and one file. The department is
 * named by the URL and its contents come from the navigation SSOT, so nothing
 * here is per-department — adding a department to the SSOT gives it a working
 * workspace with no code at all.
 *
 * This is what a home tile now opens. It used to open the department's
 * dashboard, which answered "how is the department doing" when the question
 * being asked was "what can I do here". The dashboard did not disappear: it is
 * one of the cards below, because it is one of the department's screens like
 * any other.
 */
export default function DepartmentPage() {
  const { t } = useLanguage();
  const [, params] = useRoute("/department/:slug");
  const slug = params?.slug ?? "";
  const groupTitleKey = navGroupTitleKeyForSlug(slug);

  // An unknown slug is a typed or stale URL. Saying so beats rendering an
  // empty page that looks like a department with nothing in it.
  if (!groupTitleKey) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("dept.unknown_title")} description={t("dept.unknown_body")} bordered={false} />
        <Button asChild variant="outline">
          <Link href="/">{t("nav.home")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader title={t(groupTitleKey)} description={t("dept.description")} bordered={false} />
      {/* Already filtered by the same permissions the menu applies, so a
          department whose every screen is hidden renders nothing rather than
          a grid of links that would only answer 403. */}
      <DepartmentSections groupTitleKey={groupTitleKey} />
    </div>
  );
}
