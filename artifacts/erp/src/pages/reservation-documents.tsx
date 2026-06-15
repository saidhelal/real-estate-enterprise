import {
  useListReservationDocuments,
  useCreateReservationDocument,
  useUpdateReservationDocument,
  useDeleteReservationDocument,
  getListReservationDocumentsQueryKey,
  useListReservations,
  useListCompanies,
  type ReservationDocument,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";

export default function ReservationDocumentsPage() {
  const { data: companies } = useListCompanies();
  const { data: reservations } = useListReservations({ pageSize: 200 });
  const companyId = companies?.[0]?.id;
  const reservationOptions = (reservations?.data ?? []).map((r) => ({ value: r.id, label: r.code }));

  const fields: ResourceField[] = [
    { name: "reservationId", label: "Reservation", labelAr: "الحجز", type: "select", required: true, options: reservationOptions },
    { name: "docType", label: "Document Type", labelAr: "نوع المستند", required: true },
    { name: "docNumber", label: "Document Number", labelAr: "رقم المستند" },
    { name: "fileName", label: "File Name", labelAr: "اسم الملف" },
    { name: "issueDate", label: "Issue Date", labelAr: "تاريخ الإصدار", type: "date" },
    { name: "expiryDate", label: "Expiry Date", labelAr: "تاريخ الانتهاء", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<ReservationDocument>[] = [
    { header: "Document Type", headerAr: "نوع المستند", render: (r) => <span className="font-medium">{r.docType}</span> },
    { header: "Document Number", headerAr: "رقم المستند", render: (r) => r.docNumber ?? "-" },
    { header: "File Name", headerAr: "اسم الملف", render: (r) => r.fileName ?? "-" },
    { header: "Expiry Date", headerAr: "تاريخ الانتهاء", render: (r) => r.expiryDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Reservation Documents"
      titleAr="مستندات الحجوزات"
      columns={columns}
      fields={fields}
      useList={useListReservationDocuments}
      useCreate={useCreateReservationDocument}
      useUpdate={useUpdateReservationDocument}
      useDelete={useDeleteReservationDocument}
      getListQueryKey={getListReservationDocumentsQueryKey}
      companyId={companyId}
    />
  );
}
