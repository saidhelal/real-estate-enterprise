import {
  useListCertificateStatuss,
  useCreateCertificateStatus,
  useUpdateCertificateStatus,
  useDeleteCertificateStatus,
  getListCertificateStatussQueryKey,
  useListCompanies,
  type CertificateStatus,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";

export default function CertificateStatussPage() {
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_record_status } = useLookupOptions("record_status", ["active", "inactive"]);
  const { language } = useLanguage();
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
      generatorKey: "certificateStatus",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "sequence", label: "Sequence", labelAr: "التسلسل", type: "number" },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: lk_record_status },
  ];

  const columns: ResourceColumn<CertificateStatus>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Sequence", headerAr: "التسلسل", render: (r) => r.sequence ?? "-" },
  ];

  return (
    <ResourceManager
      title="Certificate Statuses"
      titleAr="حالات المستخلص"
      columns={columns}
      fields={fields}
      useList={useListCertificateStatuss}
      useCreate={useCreateCertificateStatus}
      useUpdate={useUpdateCertificateStatus}
      useDelete={useDeleteCertificateStatus}
      getListQueryKey={getListCertificateStatussQueryKey}
      companyId={companyId}
    />
  );
}
