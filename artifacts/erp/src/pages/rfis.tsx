import {
  useListRfis,
  useCreateRfi,
  useUpdateRfi,
  useDeleteRfi,
  getListRfisQueryKey,
  useListProjects,
  useListConsultants,
  useListCompanies,
  type Rfi,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function RfisPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: projectData } = useListProjects({ pageSize: 200 });
  const projectOptions = (projectData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: consultantData } = useListConsultants({ pageSize: 200 });
  const consultantOptions = (consultantData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "rfi",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", options: projectOptions },
    { name: "subject", label: "Subject", labelAr: "الموضوع", required: true },
    { name: "question", label: "Question", labelAr: "السؤال", type: "textarea" },
    { name: "raisedBy", label: "Raised By", labelAr: "مقدم الطلب" },
    { name: "consultantId", label: "Consultant", labelAr: "الاستشاري", type: "select", options: consultantOptions },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["open", "answered", "closed"]) },
    { name: "submittedDate", label: "Submitted Date", labelAr: "تاريخ التقديم", type: "date" },
    { name: "responseDate", label: "Response Date", labelAr: "تاريخ الرد", type: "date" },
    { name: "response", label: "Response", labelAr: "الرد", type: "textarea" },
  ];

  const columns: ResourceColumn<Rfi>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Submitted Date", headerAr: "تاريخ التقديم", render: (r) => r.submittedDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="RFIs"
      titleAr="طلبات المعلومات"
      columns={columns}
      fields={fields}
      useList={useListRfis}
      useCreate={useCreateRfi}
      useUpdate={useUpdateRfi}
      useDelete={useDeleteRfi}
      getListQueryKey={getListRfisQueryKey}
      companyId={companyId}
    />
  );
}
