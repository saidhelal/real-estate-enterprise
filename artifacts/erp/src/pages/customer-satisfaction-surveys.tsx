import {
  useListCustomerSatisfactionSurveys,
  useCreateCustomerSatisfactionSurvey,
  useUpdateCustomerSatisfactionSurvey,
  useDeleteCustomerSatisfactionSurvey,
  getListCustomerSatisfactionSurveysQueryKey,
  useListCompanies,
  type CustomerSatisfactionSurvey,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function CustomerSatisfactionSurveysPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence engine on save; shown in the form
      // before saving and never typed in.
      generated: true,
      generatorKey: "customerSatisfactionSurvey",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "customerId", label: "Customer ID", labelAr: "معرّف العميل" },
    { name: "channel", label: "Channel", labelAr: "القناة", type: "select", options: enumOptions(["general", "periodic", "handover", "complaint", "maintenance", "work_order"]) },
    { name: "sourceType", label: "Source Type", labelAr: "نوع المصدر", type: "select", options: enumOptions(["handover", "complaint", "maintenance", "work_order"]) },
    { name: "sourceId", label: "Source ID", labelAr: "معرّف المصدر" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["sent", "responded", "closed"]) },
    { name: "surveyDate", label: "Survey Date", labelAr: "تاريخ الاستبيان", type: "date" },
    { name: "overallRating", label: "Overall Rating", labelAr: "التقييم العام", type: "money" },
    { name: "npsScore", label: "NPS Score", labelAr: "مؤشر NPS", type: "money" },
    { name: "comments", label: "Comments", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<CustomerSatisfactionSurvey>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Channel", headerAr: "القناة", render: (r) => <Badge variant="secondary">{enumLabel(r.channel, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Rating", headerAr: "التقييم", render: (r) => r.overallRating ?? "-" },
  ];

  return (
    <ResourceManager
      title="Satisfaction Surveys"
      titleAr="استبيانات الرضا"
      columns={columns}
      fields={fields}
      useList={useListCustomerSatisfactionSurveys}
      useCreate={useCreateCustomerSatisfactionSurvey}
      useUpdate={useUpdateCustomerSatisfactionSurvey}
      useDelete={useDeleteCustomerSatisfactionSurvey}
      getListQueryKey={getListCustomerSatisfactionSurveysQueryKey}
      companyId={companyId}
    />
  );
}
