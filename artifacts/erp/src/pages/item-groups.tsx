import {
  useListItemGroups,
  useCreateItemGroup,
  useUpdateItemGroup,
  useDeleteItemGroup,
  getListItemGroupsQueryKey,
  useListItemCategorys,
  useListCompanies,
  type ItemGroup,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function ItemGroupsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: categoryData } = useListItemCategorys({ pageSize: 200 });
  const categoryOptions = (categoryData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Code",
      labelAr: "الرمز",
      // Issued by the central sequence engine on save; shown in the form
      // before saving and never typed in.
      generated: true,
      generatorKey: "itemGroup",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "categoryId", label: "Category", labelAr: "الفئة", type: "select", options: categoryOptions },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["active", "inactive"]) },
  ];

  const columns: ResourceColumn<ItemGroup>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Item Groups"
      titleAr="مجموعات الأصناف"
      columns={columns}
      fields={fields}
      useList={useListItemGroups}
      useCreate={useCreateItemGroup}
      useUpdate={useUpdateItemGroup}
      useDelete={useDeleteItemGroup}
      getListQueryKey={getListItemGroupsQueryKey}
      companyId={companyId}
    />
  );
}
