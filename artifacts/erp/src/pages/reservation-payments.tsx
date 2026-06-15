import {
  useListReservationPayments,
  useCreateReservationPayment,
  useUpdateReservationPayment,
  useDeleteReservationPayment,
  getListReservationPaymentsQueryKey,
  useListReservations,
  useListCompanies,
  type ReservationPayment,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

const METHOD = enumOptions(["cash", "bank_transfer", "cheque", "card"]);

export default function ReservationPaymentsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: reservations } = useListReservations({ pageSize: 200 });
  const companyId = companies?.[0]?.id;

  const reservationOptions = (reservations?.data ?? []).map((r) => ({ value: r.id, label: r.code }));

  const fields: ResourceField[] = [
    { name: "reservationId", label: "Reservation", labelAr: "الحجز", type: "select", required: true, options: reservationOptions },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "paymentDate", label: "Payment Date", labelAr: "تاريخ الدفع", type: "date", required: true },
    { name: "method", label: "Method", labelAr: "طريقة الدفع", type: "select", required: true, options: METHOD },
    { name: "reference", label: "Reference", labelAr: "المرجع" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<ReservationPayment>[] = [
    { header: "Date", headerAr: "التاريخ", render: (r) => r.paymentDate },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount ?? "-" },
    { header: "Method", headerAr: "طريقة الدفع", render: (r) => <Badge variant="secondary">{enumLabel(r.method, language)}</Badge> },
    { header: "Reference", headerAr: "المرجع", render: (r) => r.reference ?? "-" },
  ];

  return (
    <ResourceManager
      title="Reservation Payments"
      titleAr="مدفوعات الحجز"
      columns={columns}
      fields={fields}
      useList={useListReservationPayments}
      useCreate={useCreateReservationPayment}
      useUpdate={useUpdateReservationPayment}
      useDelete={useDeleteReservationPayment}
      getListQueryKey={getListReservationPaymentsQueryKey}
      companyId={companyId}
    />
  );
}
