import {
  useListWarehouseLocations,
  useCreateWarehouseLocation,
  useUpdateWarehouseLocation,
  useDeleteWarehouseLocation,
  getListWarehouseLocationsQueryKey,
  useListWarehouses,
  useListCompanies,
  type WarehouseLocation,
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

export default function WarehouseLocationsPage() {
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_record_status } = useLookupOptions("record_status", ["active", "inactive"]);
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: warehouseData } = useListWarehouses({ pageSize: 200 });
  const warehouseOptions = (warehouseData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "warehouseId", label: "Warehouse", labelAr: "المستودع", type: "select", options: warehouseOptions },
    { name: "zone", label: "Zone", labelAr: "المنطقة" },
    { name: "aisle", label: "Aisle", labelAr: "الممر" },
    { name: "rack", label: "Rack", labelAr: "الرف" },
    { name: "shelf", label: "Shelf", labelAr: "الرف الفرعي" },
    { name: "bin", label: "Bin", labelAr: "الصندوق" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: lk_record_status },
  ];

  const columns: ResourceColumn<WarehouseLocation>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Warehouse Locations"
      titleAr="مواقع المستودعات"
      columns={columns}
      fields={fields}
      useList={useListWarehouseLocations}
      useCreate={useCreateWarehouseLocation}
      useUpdate={useUpdateWarehouseLocation}
      useDelete={useDeleteWarehouseLocation}
      getListQueryKey={getListWarehouseLocationsQueryKey}
      companyId={companyId}
    />
  );
}
