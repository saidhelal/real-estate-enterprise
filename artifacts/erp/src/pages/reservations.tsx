import {
  useListReservations,
  useCreateReservation,
  useUpdateReservation,
  useDeleteReservation,
  getListReservationsQueryKey,
  useListBranches,
  useListUnits,
  useListCustomers,
  useListCompanies,
  type Reservation,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const STATUS = [
  { value: "active", label: "Active" },
  { value: "converted", label: "Converted" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];

export default function ReservationsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: branches } = useListBranches();
  const { data: units } = useListUnits({ pageSize: 200 });
  const { data: customers } = useListCustomers({ pageSize: 200 });
  const companyId = companies?.[0]?.id;

  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));
  const unitOptions = (units?.data ?? []).map((u) => ({ value: u.id, label: u.name }));
  const customerOptions = (customers?.data ?? []).map((c) => ({ value: c.id, label: c.fullName }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "branchId", label: "Branch", labelAr: "الفرع", type: "select", options: branchOptions },
    { name: "unitId", label: "Unit", labelAr: "الوحدة", type: "select", required: true, options: unitOptions },
    { name: "customerId", label: "Customer", labelAr: "العميل", type: "select", required: true, options: customerOptions },
    { name: "reservationDate", label: "Reservation Date", labelAr: "تاريخ الحجز", type: "date", required: true },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", required: true, options: STATUS },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Reservation>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Date", headerAr: "التاريخ", render: (r) => r.reservationDate },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{r.status}</Badge> },
  ];

  return (
    <ResourceManager
      title="Reservations"
      titleAr="الحجوزات"
      columns={columns}
      fields={fields}
      useList={useListReservations}
      useCreate={useCreateReservation}
      useUpdate={useUpdateReservation}
      useDelete={useDeleteReservation}
      getListQueryKey={getListReservationsQueryKey}
      companyId={companyId}
    />
  );
}
