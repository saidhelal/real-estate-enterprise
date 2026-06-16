import {
  useListSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  getListSuppliersQueryKey,
  useListSupplierCategorys,
  useListCompanies,
  type Supplier,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function SuppliersPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: categoryData } = useListSupplierCategorys({ pageSize: 200 });
  const categoryOptions = (categoryData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "categoryId", label: "Category", labelAr: "الفئة", type: "select", options: categoryOptions },
    { name: "classification", label: "Classification", labelAr: "التصنيف", type: "select", options: enumOptions(["local", "international", "manufacturer", "distributor", "service_provider"]) },
    { name: "contactPerson", label: "Contact Person", labelAr: "جهة الاتصال" },
    { name: "email", label: "Email", labelAr: "البريد الإلكتروني" },
    { name: "phone", label: "Phone", labelAr: "الهاتف" },
    { name: "taxNumber", label: "Tax Number", labelAr: "الرقم الضريبي" },
    { name: "commercialReg", label: "Commercial Reg.", labelAr: "السجل التجاري" },
    { name: "address", label: "Address", labelAr: "العنوان", type: "textarea" },
    { name: "paymentTerms", label: "Payment Terms", labelAr: "شروط الدفع" },
    { name: "rating", label: "Rating", labelAr: "التقييم", type: "number" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["active", "inactive", "blacklist"]) },
  ];

  const columns: ResourceColumn<Supplier>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Classification", headerAr: "التصنيف", render: (r) => <Badge variant="secondary">{enumLabel(r.classification, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Rating", headerAr: "التقييم", render: (r) => r.rating ?? "-" },
  ];

  return (
    <ResourceManager
      title="Suppliers"
      titleAr="الموردون"
      columns={columns}
      fields={fields}
      useList={useListSuppliers}
      useCreate={useCreateSupplier}
      useUpdate={useUpdateSupplier}
      useDelete={useDeleteSupplier}
      getListQueryKey={getListSuppliersQueryKey}
      companyId={companyId}
    />
  );
}
