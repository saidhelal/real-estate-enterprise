import {
  useListHandoverRequests,
  useCreateHandoverRequest,
  useUpdateHandoverRequest,
  useDeleteHandoverRequest,
  getListHandoverRequestsQueryKey,
  useListCompanies,
  type HandoverRequest,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { useLanguage } from "@/lib/language-provider";

export default function HandoverRequestsPage() {
  const { language } = useLanguage();
  const { options: HANDOVER_TYPE } = useLookupOptions("handover_type", ["initial", "final"]);
  const { options: STATUS } = useLookupOptions("handover_status", ["requested", "scheduled", "in_progress", "completed", "cancelled"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Code",
      labelAr: "الرمز",
      // Issued by the central sequence engine on save; shown in the form
      // before saving and never typed in.
      generated: true,
      generatorKey: "handoverRequest",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "unitId", label: "Unit ID", labelAr: "معرّف الوحدة", required: true },
    { name: "customerId", label: "Customer ID", labelAr: "معرّف العميل" },
    { name: "contractId", label: "Contract ID", labelAr: "معرّف العقد" },
    { name: "reservationId", label: "Reservation ID", labelAr: "معرّف الحجز" },
    { name: "handoverType", label: "Handover Type", labelAr: "نوع التسليم", type: "select", options: HANDOVER_TYPE },
    { name: "requestDate", label: "Request Date", labelAr: "تاريخ الطلب", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: STATUS },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<HandoverRequest>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.handoverType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Request Date", headerAr: "تاريخ الطلب", render: (r) => r.requestDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Handover Requests"
      titleAr="طلبات التسليم"
      columns={columns}
      fields={fields}
      useList={useListHandoverRequests}
      useCreate={useCreateHandoverRequest}
      useUpdate={useUpdateHandoverRequest}
      useDelete={useDeleteHandoverRequest}
      getListQueryKey={getListHandoverRequestsQueryKey}
      companyId={companyId}
    />
  );
}
