import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/language-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, UserPlus, BookMarked, FileSignature } from "lucide-react";
import { enumLabel } from "@/lib/enums";
import {
  useListCustomers,
  useListLeads,
  useListReservations,
  useListContracts,
} from "@workspace/api-client-react";

const PAGE = { pageSize: 200 } as const;

export default function GlobalSearchPage() {
  const { t, language } = useLanguage();
  const [query, setQuery] = useState("");

  const { data: customers } = useListCustomers(PAGE);
  const { data: leads } = useListLeads(PAGE);
  const { data: reservations } = useListReservations(PAGE);
  const { data: contracts } = useListContracts(PAGE);

  const q = query.trim().toLowerCase();
  const active = q.length >= 2;

  const customerRows = customers?.data ?? [];
  const leadRows = leads?.data ?? [];
  const reservationRows = reservations?.data ?? [];
  const contractRows = contracts?.data ?? [];

  const matchedCustomers = useMemo(() => {
    if (!active) return [];
    return customerRows.filter((c) =>
      [c.code, c.fullName, c.nameAr, c.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [active, customerRows, q]);

  const matchedLeads = useMemo(() => {
    if (!active) return [];
    return leadRows.filter((l) =>
      [l.code, l.fullName, l.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [active, leadRows, q]);

  const customerIds = useMemo(
    () => new Set(matchedCustomers.map((c) => c.id)),
    [matchedCustomers],
  );

  const matchedReservations = useMemo(() => {
    if (!active) return [];
    return reservationRows.filter(
      (r) =>
        String(r.code ?? "").toLowerCase().includes(q) ||
        (r.customerId != null && customerIds.has(r.customerId)),
    );
  }, [active, reservationRows, q, customerIds]);

  const matchedContracts = useMemo(() => {
    if (!active) return [];
    return contractRows.filter(
      (c) =>
        String(c.code ?? "").toLowerCase().includes(q) ||
        (c.customerId != null && customerIds.has(c.customerId)),
    );
  }, [active, contractRows, q, customerIds]);

  const totalResults =
    matchedCustomers.length +
    matchedLeads.length +
    matchedReservations.length +
    matchedContracts.length;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t("global_search.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("global_search.subtitle")}</p>
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:left-auto rtl:right-3" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("global_search.placeholder")}
          className="pl-9 rtl:pl-3 rtl:pr-9"
        />
      </div>

      {!active ? (
        <p className="text-sm text-muted-foreground">{t("global_search.prompt")}</p>
      ) : totalResults === 0 ? (
        <p className="text-sm text-muted-foreground">{t("global_search.empty")}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ResultCard
            title={t("global_search.section.customers")}
            icon={Users}
            count={matchedCustomers.length}
          >
            {matchedCustomers.map((c) => (
              <ResultRow
                key={c.id}
                href="/customers"
                code={c.code}
                title={language === "ar" ? c.nameAr ?? c.fullName : c.fullName}
                meta={c.phone ?? undefined}
                badge={c.classification ? enumLabel(c.classification, language) : undefined}
              />
            ))}
          </ResultCard>

          <ResultCard
            title={t("global_search.section.leads")}
            icon={UserPlus}
            count={matchedLeads.length}
          >
            {matchedLeads.map((l) => (
              <ResultRow
                key={l.id}
                href="/leads"
                code={l.code}
                title={l.fullName}
                meta={l.phone ?? undefined}
                badge={l.status ? enumLabel(l.status, language) : undefined}
              />
            ))}
          </ResultCard>

          <ResultCard
            title={t("global_search.section.reservations")}
            icon={BookMarked}
            count={matchedReservations.length}
          >
            {matchedReservations.map((r) => (
              <ResultRow
                key={r.id}
                href="/reservations"
                code={r.code}
                title={r.reservationDate ?? r.code}
                meta={r.amount != null ? String(r.amount) : undefined}
                badge={r.status ? enumLabel(r.status, language) : undefined}
              />
            ))}
          </ResultCard>

          <ResultCard
            title={t("global_search.section.contracts")}
            icon={FileSignature}
            count={matchedContracts.length}
          >
            {matchedContracts.map((c) => (
              <ResultRow
                key={c.id}
                href="/contracts"
                code={c.code}
                title={c.contractDate ?? c.code}
                meta={c.totalPrice != null ? String(c.totalPrice) : undefined}
                badge={c.status ? enumLabel(c.status, language) : undefined}
              />
            ))}
          </ResultCard>
        </div>
      )}
    </div>
  );
}

function ResultCard({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: any;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <Badge variant="secondary">{count}</Badge>
      </CardHeader>
      <CardContent className="space-y-1">
        {count === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">-</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function ResultRow({
  href,
  code,
  title,
  meta,
  badge,
}: {
  href: string;
  code?: string | null;
  title?: string | null;
  meta?: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title || code}</p>
        <p className="truncate text-xs text-muted-foreground">
          {code}
          {meta ? ` · ${meta}` : ""}
        </p>
      </div>
      {badge ? <Badge variant="outline" className="shrink-0">{badge}</Badge> : null}
    </Link>
  );
}
