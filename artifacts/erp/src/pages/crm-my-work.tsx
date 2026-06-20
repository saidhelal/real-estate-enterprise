import {
  useListLeads,
  getListLeadsQueryKey,
  useListLeadFollowUps,
  getListLeadFollowUpsQueryKey,
  useListContracts,
  getListContractsQueryKey,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";
import { useAuth } from "@/lib/auth-provider";
import {
  UserPlus,
  CalendarClock,
  AlertTriangle,
  Undo2,
  Clock,
  FileSignature,
} from "lucide-react";

const todayKey = () => new Date().toISOString().slice(0, 10);

function Section({
  icon: Icon,
  title,
  count,
  href,
  tone = "default",
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  href: string;
  tone?: "default" | "warning" | "danger";
  children?: React.ReactNode;
}) {
  const toneClass =
    tone === "danger"
      ? "border-destructive/40"
      : tone === "warning"
        ? "border-amber-500/40"
        : "";
  return (
    <Link href={href}>
      <Card className={`cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium">
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              {title}
            </span>
            <Badge variant={tone === "danger" ? "destructive" : "secondary"}>{count}</Badge>
          </CardTitle>
        </CardHeader>
        {children ? <CardContent className="pt-0 text-sm text-muted-foreground">{children}</CardContent> : null}
      </Card>
    </Link>
  );
}

export default function MyWorkPage() {
  const { language, t } = useLanguage();
  const ar = language === "ar";
  const { user } = useAuth();
  const meId = user?.id;

  const leadParams = { pageSize: 200 } as const;
  const { data: leads, isLoading: leadsLoading } = useListLeads(leadParams, {
    query: { queryKey: getListLeadsQueryKey(leadParams) },
  });
  const fuParams = { pageSize: 200 } as const;
  const { data: followUps } = useListLeadFollowUps(fuParams, {
    query: { queryKey: getListLeadFollowUpsQueryKey(fuParams) },
  });
  const contractParams = { pageSize: 200 } as const;
  const { data: contracts } = useListContracts(contractParams, {
    query: { queryKey: getListContractsQueryKey(contractParams) },
  });

  const myLeads = (leads?.data ?? []).filter((l) => !meId || l.assignedToUserId === meId);
  const myFollowUps = (followUps?.data ?? []).filter(
    (f) => f.status !== "done" && f.status !== "completed" && f.status !== "cancelled",
  );
  const today = todayKey();
  const todaysFollowUps = myFollowUps.filter((f) => f.dueDate?.slice(0, 10) === today);
  const overdueFollowUps = myFollowUps.filter((f) => f.dueDate && f.dueDate.slice(0, 10) < today);

  const allContracts = contracts?.data ?? [];
  // A contract returned by Finance goes back to status "draft" but carries a
  // finance review timestamp; a brand-new draft has none.
  const returnedFromFinance = allContracts.filter(
    (c) => c.status === "draft" && c.financeReviewedAt != null,
  );
  // In the approval pipeline: awaiting Finance ("pending_finance") or awaiting
  // Legal activation ("finance_approved").
  const awaitingApproval = allContracts.filter(
    (c) => c.status === "pending_finance" || c.status === "finance_approved",
  );
  const contractsReady = allContracts.filter((c) => c.status === "active");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.my_work")}</h1>
        <p className="text-sm text-muted-foreground">
          {ar
            ? "مهامك اليومية — تابع كل بند مباشرة من شاشته"
            : "Your daily work — open each item directly on its screen"}
        </p>
      </div>

      {leadsLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Section icon={UserPlus} title={ar ? "العملاء المحتملون المسندون إليّ" : "Assigned Leads"} count={myLeads.length} href="/leads" />
          <Section icon={CalendarClock} title={ar ? "متابعات اليوم" : "Today's Follow-ups"} count={todaysFollowUps.length} href="/lead-follow-ups" tone={todaysFollowUps.length ? "warning" : "default"} />
          <Section icon={AlertTriangle} title={ar ? "متابعات متأخرة" : "Overdue Follow-ups"} count={overdueFollowUps.length} href="/lead-follow-ups" tone={overdueFollowUps.length ? "danger" : "default"} />
          <Section icon={Undo2} title={ar ? "مُعاد من المالية" : "Returned From Finance"} count={returnedFromFinance.length} href="/contracts" tone={returnedFromFinance.length ? "warning" : "default"} />
          <Section icon={Clock} title={ar ? "قيد الاعتماد (مالية/قانونية)" : "In Approval (Finance/Legal)"} count={awaitingApproval.length} href="/contracts" />
          <Section icon={FileSignature} title={ar ? "عقود نشطة" : "Active Contracts"} count={contractsReady.length} href="/contracts" />
        </div>
      )}
    </div>
  );
}
