import {
  useListReservations,
  getListReservationsQueryKey,
  useListContracts,
  getListContractsQueryKey,
  useListReservationPayments,
  getListReservationPaymentsQueryKey,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";
import { BookMarked, FileSignature, Wallet, ArrowRightLeft, FileX } from "lucide-react";

function Tile({
  icon: Icon,
  title,
  desc,
  count,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  count?: number;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              {title}
            </span>
            {count != null ? <Badge variant="secondary">{count}</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-muted-foreground">{desc}</CardContent>
      </Card>
    </Link>
  );
}

export default function CrmSalesPage() {
  const { language, t } = useLanguage();
  const ar = language === "ar";

  const p = { pageSize: 200 } as const;
  const { data: reservations } = useListReservations(p, { query: { queryKey: getListReservationsQueryKey(p) } });
  const { data: contracts } = useListContracts(p, { query: { queryKey: getListContractsQueryKey(p) } });
  const { data: payments } = useListReservationPayments(p, { query: { queryKey: getListReservationPaymentsQueryKey(p) } });

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.crm_sales")}</h1>
        <p className="text-sm text-muted-foreground">
          {ar ? "إدارة دورة المبيعات: الحجوزات والعقود والمدفوعات" : "Manage the sales cycle: reservations, contracts and payments"}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile icon={BookMarked} title={ar ? "الحجوزات" : "Reservations"} desc={ar ? "إنشاء ومتابعة حجوزات الوحدات" : "Create and track unit reservations"} count={reservations?.total ?? reservations?.data.length} href="/reservations" />
        <Tile icon={FileSignature} title={ar ? "العقود" : "Contracts"} desc={ar ? "عقود البيع ودورة الاعتماد" : "Sales contracts and approval cycle"} count={contracts?.total ?? contracts?.data.length} href="/contracts" />
        <Tile icon={Wallet} title={ar ? "مدفوعات الحجز" : "Reservation Payments"} desc={ar ? "دفعات الحجز المستلمة" : "Received reservation payments"} count={payments?.total ?? payments?.data.length} href="/reservation-payments" />
        <Tile icon={ArrowRightLeft} title={ar ? "تحويل الوحدات" : "Unit Transfers"} desc={ar ? "تحويل العقود بين الوحدات" : "Transfer contracts between units"} href="/unit-transfers" />
        <Tile icon={FileX} title={ar ? "إلغاء العقود" : "Contract Cancellations"} desc={ar ? "طلبات إلغاء العقود" : "Contract cancellation requests"} href="/contract-cancellations" />
      </div>
    </div>
  );
}
