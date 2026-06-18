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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
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

const PRIORITY_VARIANT: Record<string, { badge: string; key: string }> = {
  normal: { badge: "bg-slate-500/10 text-slate-600 dark:text-slate-300", key: "nc.priority.normal" },
  medium: { badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400", key: "nc.priority.medium" },
  high: { badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400", key: "nc.priority.high" },
  urgent: { badge: "bg-red-500/10 text-red-600 dark:text-red-400", key: "nc.priority.urgent" },
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

  const kpis: { labelKey: string; value?: number; icon: LucideIcon; accent: string }[] = [
    { labelKey: "nc.kpi.total", value: dash?.total, icon: Inbox, accent: "text-slate-600 dark:text-slate-300" },
    { labelKey: "nc.kpi.unread", value: dash?.unread, icon: Bell, accent: "text-sky-600 dark:text-sky-400" },
    { labelKey: "nc.kpi.urgent", value: dash?.urgent, icon: AlertTriangle, accent: "text-red-600 dark:text-red-400" },
    { labelKey: "nc.kpi.today", value: dash?.today, icon: CalendarDays, accent: "text-emerald-600 dark:text-emerald-400" },
    { labelKey: "nc.kpi.week", value: dash?.week, icon: CalendarRange, accent: "text-amber-600 dark:text-amber-400" },
    { labelKey: "nc.kpi.month", value: dash?.month, icon: CalendarRange, accent: "text-violet-600 dark:text-violet-400" },
  ];

  const dateLocale = language === "ar" ? "ar-EG" : "en-US";

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Bell className="h-5 w-5" />
          {t("nc.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("nc.subtitle")}</p>
      </div>

      {/* Dashboard KPI strip (item 19) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.labelKey} className="rounded-lg border bg-card p-3 shadow-sm">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium text-muted-foreground">{t(kpi.labelKey)}</span>
              <kpi.icon className={`h-4 w-4 shrink-0 ${kpi.accent}`} />
            </div>
            <div className="text-xl font-semibold tabular-nums tracking-tight">{formatCount(kpi.value)}</div>
          </div>
        ))}
      </div>

      {/* View tabs + search + mark-all */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
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
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:left-auto rtl:right-3" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("nc.search_placeholder")}
              className="h-9 pl-9 rtl:pl-3 rtl:pr-9"
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
        </div>
      </div>

      {/* List */}
      <div className="rounded-lg border bg-card shadow-sm">
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
                      <Badge variant="secondary" className={prio.badge}>
                        {t(prio.key)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        {n.isFavorite ? (
                          <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
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
                              <RotateCcw className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                              {t("nc.action.restore")}
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem onClick={() => patch(n.id, { isRead: !n.isRead })}>
                                {n.isRead ? (
                                  <Bell className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                                ) : (
                                  <CheckCheck className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                                )}
                                {n.isRead ? t("nc.action.mark_unread") : t("nc.action.mark_read")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => patch(n.id, { isFavorite: !n.isFavorite })}>
                                <Star className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                                {n.isFavorite ? t("nc.action.unfavorite") : t("nc.action.favorite")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => patch(n.id, { isArchived: !n.isArchived })}>
                                {n.isArchived ? (
                                  <ArchiveRestore className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                                ) : (
                                  <Archive className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                                )}
                                {n.isArchived ? t("nc.action.unarchive") : t("nc.action.archive")}
                              </DropdownMenuItem>
                              {n.link ? (
                                <DropdownMenuItem asChild>
                                  <a href={n.link}>
                                    <ExternalLink className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                                    {t("nc.action.open_link")}
                                  </a>
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem onClick={() => remove(n.id)} className="text-destructive focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
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
      </div>
    </div>
  );
}
