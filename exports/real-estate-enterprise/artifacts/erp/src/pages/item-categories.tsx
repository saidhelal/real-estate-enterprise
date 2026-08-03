import {
  useListItemCategorys,
  useCreateItemCategory,
  useUpdateItemCategory,
  useDeleteItemCategory,
  getListItemCategorysQueryKey,
  useListCompanies,
  type ItemCategory,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function ItemCategorysPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: parentData } = useListItemCategorys({ pageSize: 200 });
  const parentOptions = (parentData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "parentId", label: "Parent Category", labelAr: "الفئة الأم", type: "select", options: parentOptions },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["active", "inactive"]) },
  ];

  const columns: ResourceColumn<ItemCategory>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Item Categories"
      titleAr="فئات الأصناف"
      columns={columns}
      fields={fields}
      useList={useListItemCategorys}
      useCreate={useCreateItemCategory}
      useUpdate={useUpdateItemCategory}
      useDelete={useDeleteItemCategory}
      getListQueryKey={getListItemCategorysQueryKey}
      companyId={companyId}
    />
  );
}
