import { useMemo, useState } from "react";
import {
  useGetNotificationsDashboard,
  useListNotifications,
  useUpdateNotification,
  useDeleteNotification,
  useRestoreNotification,
  useMarkAllNotificationsRead,
  useListCompanies,
  getListNotificationsQueryKey,
  getGetNotificationsDashboardQueryKey,
  type Notification,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-provider";
import { PageHeader } from "@/components/ui/page-header";
import { Toolbar, ToolbarStart, ToolbarEnd } from "@/components/ui/toolbar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { type StatusTone } from "@/lib/design-tokens";
import {
  Table,
  TableBody,
  TableFrame,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  BellOff,
  Search,
  Star,
  Archive,
  ArchiveRestore,
  Trash2,
  RotateCcw,
  ExternalLink,
  MoreHorizontal,
  CheckCheck,
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  Inbox,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ViewKey = "all" | "unread" | "read" | "favorites" | "archived" | "trash";

const VIEWS: { key: ViewKey; labelKey: string; icon: LucideIcon }[] = [
  { key: "all", labelKey: "nc.view.all", icon: Inbox },
  { key: "unread", labelKey: "nc.view.unread", icon: Bell },
  { key: "read", labelKey: "nc.view.read", icon: BellOff },
  { key: "favorites", labelKey: "nc.view.favorites", icon: Star },
  { key: "archived", labelKey: "nc.view.archived", icon: Archive },
  { key: "trash", labelKey: "nc.view.trash", icon: Trash2 },
];

// Priority maps onto the shared tone scale rather than to colours of its own,
// so an urgent notification reads the same red as an overdue installment.
const PRIORITY_VARIANT: Record<string, { tone: StatusTone; key: string }> = {
  normal: { tone: "neutral", key: "nc.priority.normal" },
  medium: { tone: "info", key: "nc.priority.medium" },
  high: { tone: "warning", key: "nc.priority.high" },
  urgent: { tone: "error", key: "nc.priority.urgent" },
};

function formatCount(value?: number): string {
  if (value === undefined || value === null) return "—";
  return value.toLocaleString("en-US");
}

export default function NotificationsPage() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const enabled = !!companyId;

  const [view, setView] = useState<ViewKey>("all");
  const [search, setSearch] = useState("");

  const dashParams = { companyId };
  const { data: dash } = useGetNotificationsDashboard(dashParams, {
    query: { enabled, queryKey: getGetNotificationsDashboardQueryKey(dashParams) },
  });

  const listParams = useMemo(
    () => ({ companyId, view, search: search.trim() || undefined, pageSize: 100 }),
    [companyId, view, search],
  );
  const { data: list, isLoading } = useListNotifications(listParams, {
    query: { enabled, queryKey: getListNotificationsQueryKey(listParams) },
  });

  const updateMut = useUpdateNotification();
  const deleteMut = useDeleteNotification();
  const restoreMut = useRestoreNotification();
  const markAllMut = useMarkAllNotificationsRead();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/notifications-dashboard"] });
  };

  const patch = (id: string, data: Record<string, unknown>) =>
    updateMut.mutate({ id, data }, { onSuccess: invalidate });
  const remove = (id: string) => deleteMut.mutate({ id }, { onSuccess: invalidate });
  const restore = (id: string) => restoreMut.mutate({ id }, { onSuccess: invalidate });
  const markAll = () => markAllMut.mutate(undefined, { onSuccess: invalidate });

  const rows = list?.data ?? [];

  const kpis: { labelKey: string; value?: number; icon: LucideIcon; tone: StatusTone }[] = [
    // Only three of these carry a judgement. Total and the two time windows are
    // plain counts, so they stay neutral instead of borrowing green and amber
    // and implying a health reading that is not there.
    { labelKey: "nc.kpi.total", value: dash?.total, icon: Inbox, tone: "neutral" },
    { labelKey: "nc.kpi.unread", value: dash?.unread, icon: Bell, tone: "info" },
    { labelKey: "nc.kpi.urgent", value: dash?.urgent, icon: AlertTriangle, tone: "error" },
    { labelKey: "nc.kpi.today", value: dash?.today, icon: CalendarDays, tone: "neutral" },
    { labelKey: "nc.kpi.week", value: dash?.week, icon: CalendarRange, tone: "neutral" },
    { labelKey: "nc.kpi.month", value: dash?.month, icon: CalendarRange, tone: "neutral" },
  ];

  const dateLocale = language === "ar" ? "ar-EG" : "en-US";

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        icon={Bell}
        title={t("nc.title")}
        description={t("nc.subtitle")}
        bordered={false}
      />

      {/* Dashboard KPI strip (item 19) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.labelKey}
            label={t(kpi.labelKey)}
            value={formatCount(kpi.value)}
            icon={kpi.icon}
            tone={kpi.tone}
          />
        ))}
      </div>

      {/* The list and the controls that drive it share one frame, so the strip
          reads as belonging to this list — the same shape ResourceManager uses. */}
      <TableFrame>
        <Toolbar transparent className="border-b border-border">
          <ToolbarStart>
          {VIEWS.map((v) => {
            const active = v.key === view;
            return (
              <Button
                key={v.key}
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => setView(v.key)}
                className="gap-1.5"
              >
                <v.icon className="h-3.5 w-3.5" />
                {t(v.labelKey)}
              </Button>
            );
          })}
          </ToolbarStart>
          <ToolbarEnd>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:left-auto rtl:right-3" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("nc.search_placeholder")}
              className="h-9 ps-9 rtl:ps-3 rtl:pe-9"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={markAll}
            disabled={markAllMut.isPending || !enabled}
            className="gap-1.5 whitespace-nowrap"
          >
            <CheckCheck className="h-4 w-4" />
            {t("nc.mark_all_read")}
          </Button>
          </ToolbarEnd>
        </Toolbar>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">{t("nc.col.priority")}</TableHead>
              <TableHead>{t("nc.col.notification")}</TableHead>
              <TableHead className="w-[140px]">{t("nc.col.module")}</TableHead>
              <TableHead className="w-[150px]">{t("nc.col.date")}</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  …
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  {t("nc.empty")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((n: Notification) => {
                const prio = PRIORITY_VARIANT[n.priority] ?? PRIORITY_VARIANT.normal;
                const inTrash = view === "trash";
                return (
                  <TableRow key={n.id} className={n.isRead ? "" : "bg-muted/30"}>
                    <TableCell>
                      <StatusBadge tone={prio.tone} label={t(prio.key)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        {n.isFavorite ? (
                          <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-warning text-warning" />
                        ) : null}
                        <div className="min-w-0">
                          <div className={`truncate ${n.isRead ? "font-normal" : "font-semibold"}`}>
                            {n.title}
                          </div>
                          {n.body ? (
                            <div className="truncate text-xs text-muted-foreground">{n.body}</div>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {n.sourceModule ? (
                        <span className="text-xs text-muted-foreground">{n.sourceModule}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {new Date(n.createdAt).toLocaleDateString(dateLocale, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {inTrash ? (
                            <DropdownMenuItem onClick={() => restore(n.id)}>
                              <RotateCcw className="me-2 h-4 w-4 rtl:ms-2 rtl:me-0" />
                              {t("nc.action.restore")}
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem onClick={() => patch(n.id, { isRead: !n.isRead })}>
                                {n.isRead ? (
                                  <Bell className="me-2 h-4 w-4 rtl:ms-2 rtl:me-0" />
                                ) : (
                                  <CheckCheck className="me-2 h-4 w-4 rtl:ms-2 rtl:me-0" />
                                )}
                                {n.isRead ? t("nc.action.mark_unread") : t("nc.action.mark_read")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => patch(n.id, { isFavorite: !n.isFavorite })}>
                                <Star className="me-2 h-4 w-4 rtl:ms-2 rtl:me-0" />
                                {n.isFavorite ? t("nc.action.unfavorite") : t("nc.action.favorite")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => patch(n.id, { isArchived: !n.isArchived })}>
                                {n.isArchived ? (
                                  <ArchiveRestore className="me-2 h-4 w-4 rtl:ms-2 rtl:me-0" />
                                ) : (
                                  <Archive className="me-2 h-4 w-4 rtl:ms-2 rtl:me-0" />
                                )}
                                {n.isArchived ? t("nc.action.unarchive") : t("nc.action.archive")}
                              </DropdownMenuItem>
                              {n.link ? (
                                <DropdownMenuItem asChild>
                                  <a href={n.link}>
                                    <ExternalLink className="me-2 h-4 w-4 rtl:ms-2 rtl:me-0" />
                                    {t("nc.action.open_link")}
                                  </a>
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem onClick={() => remove(n.id)} className="text-destructive focus:text-destructive">
                                <Trash2 className="me-2 h-4 w-4 rtl:ms-2 rtl:me-0" />
                                {t("nc.action.delete")}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableFrame>
    </div>
  );
}
