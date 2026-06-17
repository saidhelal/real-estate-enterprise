import { useState } from "react";
import { Link } from "wouter";
import {
  useCrmGlobalSearch,
  getCrmGlobalSearchQueryKey,
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
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";

interface Hit {
  id: string;
  code: string;
  label?: string | null;
  status?: string | null;
}

export default function CrmSearchPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const [term, setTerm] = useState("");

  const params = { q: term, companyId };
  const { data, isFetching } = useCrmGlobalSearch(params, {
    query: { enabled: term.trim().length > 0, queryKey: getCrmGlobalSearchQueryKey(params) },
  });

  const section = (
    title: string,
    hits: Hit[],
    href: (h: Hit) => string | null,
  ) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {title} ({hits.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.code")}</TableHead>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-16 text-muted-foreground">
                  {t("common.no_data")}
                </TableCell>
              </TableRow>
            ) : (
              hits.map((h) => {
                const to = href(h);
                return (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">
                      {to ? (
                        <Link href={to} className="text-primary hover:underline">
                          {h.code}
                        </Link>
                      ) : (
                        h.code
                      )}
                    </TableCell>
                    <TableCell>{h.label ?? "-"}</TableCell>
                    <TableCell>
                      {h.status ? <Badge variant="secondary">{enumLabel(h.status, language)}</Badge> : "-"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold tracking-tight">{t("crm.search.title")}</h2>

      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={t("crm.search.placeholder")}
        className="max-w-md"
      />

      {term.trim().length === 0 ? (
        <p className="text-muted-foreground">{t("crm.search.hint")}</p>
      ) : isFetching ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {section(t("crm.search.customers"), data?.customers ?? [], (h) => `/crm/customers/${h.id}`)}
          {section(t("crm.search.units"), data?.units ?? [], () => "/units")}
          {section(t("crm.search.contracts"), data?.contracts ?? [], () => "/contracts")}
          {section(t("crm.search.reservations"), data?.reservations ?? [], () => "/reservations")}
        </div>
      )}
    </div>
  );
}
