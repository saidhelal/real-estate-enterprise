import {
  useListUnitPriceLists,
  useCreateUnitPriceList,
  useUpdateUnitPriceList,
  useDeleteUnitPriceList,
  getListUnitPriceListsQueryKey,
  useListProjects,
  useListCompanies,
  type UnitPriceList,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function UnitPriceListsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: projects } = useListProjects({ pageSize: 200 });
  const companyId = companies?.[0]?.id;
  const projectOptions = (projects?.data ?? []).map((p) => ({ value: p.id, label: p.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", options: projectOptions },
    { name: "effectiveFrom", label: "Effective From", labelAr: "ساري من", type: "date" },
    { name: "effectiveTo", label: "Effective To", labelAr: "ساري إلى", type: "date" },
  ];

  const columns: ResourceColumn<UnitPriceList>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Effective From", headerAr: "ساري من", render: (r) => r.effectiveFrom ?? "-" },
    { header: "Effective To", headerAr: "ساري إلى", render: (r) => r.effectiveTo ?? "-" },
  ];

  return (
    <ResourceManager
      title="Unit Price Lists"
      titleAr="قوائم أسعار الوحدات"
      columns={columns}
      fields={fields}
      useList={useListUnitPriceLists}
      useCreate={useCreateUnitPriceList}
      useUpdate={useUpdateUnitPriceList}
      useDelete={useDeleteUnitPriceList}
      getListQueryKey={getListUnitPriceListsQueryKey}
      companyId={companyId}
    />
  );
}
