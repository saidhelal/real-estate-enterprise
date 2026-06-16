import {
  useListContractors,
  useCreateContractor,
  useUpdateContractor,
  useDeleteContractor,
  getListContractorsQueryKey,
  useListCompanies,
  type Contractor,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function ContractorsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "classification", label: "Classification", labelAr: "التصنيف" },
    { name: "contactPerson", label: "Contact Person", labelAr: "جهة الاتصال" },
    { name: "email", label: "Email", labelAr: "البريد الإلكتروني" },
    { name: "phone", label: "Phone", labelAr: "الهاتف" },
    { name: "licenseNumber", label: "License Number", labelAr: "رقم الترخيص" },
    { name: "address", label: "Address", labelAr: "العنوان", type: "textarea" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["active", "suspended", "terminated", "inactive"]) },
  ];

  const columns: ResourceColumn<Contractor>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Contractors"
      titleAr="المقاولون"
      columns={columns}
      fields={fields}
      useList={useListContractors}
      useCreate={useCreateContractor}
      useUpdate={useUpdateContractor}
      useDelete={useDeleteContractor}
      getListQueryKey={getListContractorsQueryKey}
      companyId={companyId}
    />
  );
}
