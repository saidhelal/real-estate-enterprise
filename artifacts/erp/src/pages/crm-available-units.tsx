import { useState } from "react";
import {
  useListCrmAvailableUnits,
  getListCrmAvailableUnitsQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";

const PAGE_SIZE = 25;

export default function CrmAvailableUnitsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params = { companyId, search: search || undefined, page, pageSize: PAGE_SIZE };
  const { data, isLoading } = useListCrmAvailableUnits(params, {
    query: { enabled: !!companyId, queryKey: getListCrmAvailableUnitsQueryKey(params) },
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold tracking-tight">{t("crm.available_units.title")}</h2>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t("crm.available_units.list")}</CardTitle>
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("common.search")}
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("crm.unit.code")}</TableHead>
                <TableHead>{t("crm.unit.name")}</TableHead>
                <TableHead>{t("crm.unit.project")}</TableHead>
                <TableHead>{t("crm.unit.building")}</TableHead>
                <TableHead>{t("crm.unit.type")}</TableHead>
                <TableHead className="text-end">{t("crm.unit.area")}</TableHead>
                <TableHead className="text-end">{t("crm.unit.price")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                    {t("common.no_data")}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.code}</TableCell>
                    <TableCell>{language === "ar" ? u.nameAr ?? u.name : u.name}</TableCell>
                    <TableCell>{u.projectName ?? "-"}</TableCell>
                    <TableCell>{u.buildingName ?? "-"}</TableCell>
                    <TableCell>{u.unitTypeName ?? "-"}</TableCell>
                    <TableCell className="text-end">{u.area ?? "-"}</TableCell>
                    <TableCell className="text-end">{u.basePrice ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{enumLabel(u.status, language)}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">
              {t("common.total")}: {total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t("common.previous")}
              </Button>
              <span className="text-sm">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
