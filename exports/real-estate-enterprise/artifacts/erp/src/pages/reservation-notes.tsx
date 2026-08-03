import {
  useListReservationNotes,
  useCreateReservationNote,
  useUpdateReservationNote,
  useDeleteReservationNote,
  getListReservationNotesQueryKey,
  useListReservations,
  useListUsers,
  useListCompanies,
  type ReservationNote,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";

export default function ReservationNotesPage() {
  const { data: companies } = useListCompanies();
  const { data: reservations } = useListReservations({ pageSize: 200 });
  const { data: users } = useListUsers();
  const companyId = companies?.[0]?.id;
  const reservationOptions = (reservations?.data ?? []).map((r) => ({ value: r.id, label: r.code }));
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.fullName ?? u.username }));

  const fields: ResourceField[] = [
    { name: "reservationId", label: "Reservation", labelAr: "الحجز", type: "select", required: true, options: reservationOptions },
    { name: "userId", label: "User", labelAr: "المستخدم", type: "select", options: userOptions },
    { name: "note", label: "Note", labelAr: "ملاحظة", type: "textarea", required: true },
  ];

  const columns: ResourceColumn<ReservationNote>[] = [
    { header: "Note", headerAr: "ملاحظة", render: (r) => <span className="font-medium">{r.note}</span> },
  ];

  return (
    <ResourceManager
      title="Reservation Notes"
      titleAr="ملاحظات الحجوزات"
      columns={columns}
      fields={fields}
      useList={useListReservationNotes}
      useCreate={useCreateReservationNote}
      useUpdate={useUpdateReservationNote}
      useDelete={useDeleteReservationNote}
      getListQueryKey={getListReservationNotesQueryKey}
      companyId={companyId}
    />
  );
}
