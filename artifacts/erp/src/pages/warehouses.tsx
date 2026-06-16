import {
  useListWarehouses,
  useCreateWarehouse,
  useUpdateWarehouse,
  useDeleteWarehouse,
  getListWarehousesQueryKey,
  useListBranches,
  useListCompanies,
  type Warehouse,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function WarehousesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: branchData } = useListBranches();
  const branchOptions = (branchData ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "branchId", label: "Branch", labelAr: "الفرع", type: "select", options: branchOptions },
    { name: "warehouseType", label: "Warehouse Type", labelAr: "نوع المستودع", type: "select", options: enumOptions(["main", "transit", "virtual", "quarantine"]) },
    { name: "address", label: "Address", labelAr: "العنوان", type: "textarea" },
    { name: "manager", label: "Manager", labelAr: "المدير" },
    { name: "phone", label: "Phone", labelAr: "الهاتف" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["active", "inactive"]) },
  ];

  const columns: ResourceColumn<Warehouse>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Warehouse Type", headerAr: "نوع المستودع", render: (r) => <Badge variant="secondary">{enumLabel(r.warehouseType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Warehouses"
      titleAr="المستودعات"
      columns={columns}
      fields={fields}
      useList={useListWarehouses}
      useCreate={useCreateWarehouse}
      useUpdate={useUpdateWarehouse}
      useDelete={useDeleteWarehouse}
      getListQueryKey={getListWarehousesQueryKey}
      companyId={companyId}
    />
  );
}
