import {
  useListUnitOfMeasures,
  useCreateUnitOfMeasure,
  useUpdateUnitOfMeasure,
  useDeleteUnitOfMeasure,
  getListUnitOfMeasuresQueryKey,
  useListCompanies,
  type UnitOfMeasure,
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

export default function UnitOfMeasuresPage() {
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_record_status } = useLookupOptions("record_status", ["active", "inactive"]);
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "symbol", label: "Symbol", labelAr: "الرمز المختصر" },
    { name: "baseUnit", label: "Base Unit", labelAr: "الوحدة الأساسية" },
    { name: "conversionFactor", label: "Conversion Factor", labelAr: "معامل التحويل", type: "number" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: lk_record_status },
  ];

  const columns: ResourceColumn<UnitOfMeasure>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Conversion Factor", headerAr: "معامل التحويل", render: (r) => r.conversionFactor ?? "-" },
  ];

  return (
    <ResourceManager
      title="Units of Measure"
      titleAr="وحدات القياس"
      columns={columns}
      fields={fields}
      useList={useListUnitOfMeasures}
      useCreate={useCreateUnitOfMeasure}
      useUpdate={useUpdateUnitOfMeasure}
      useDelete={useDeleteUnitOfMeasure}
      getListQueryKey={getListUnitOfMeasuresQueryKey}
      companyId={companyId}
    />
  );
}
