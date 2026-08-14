import {
  useListUnitDiscounts,
  useCreateUnitDiscount,
  useUpdateUnitDiscount,
  useDeleteUnitDiscount,
  getListUnitDiscountsQueryKey,
  useListCompanies,
  type UnitDiscount,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { useLanguage } from "@/lib/language-provider";

export default function UnitDiscountsPage() {
  const { language } = useLanguage();
  const { options: DISCOUNT_TYPE } = useLookupOptions("discount_type", ["percentage", "fixed"]);
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
      generatorKey: "unitDiscount",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "discountType", label: "Discount Type", labelAr: "نوع الخصم", type: "select", required: true, options: DISCOUNT_TYPE },
    { name: "discountValue", label: "Discount Value", labelAr: "قيمة الخصم", type: "money" },
    { name: "validFrom", label: "Valid From", labelAr: "ساري من", type: "date" },
    { name: "validTo", label: "Valid To", labelAr: "ساري إلى", type: "date" },
  ];

  const columns: ResourceColumn<UnitDiscount>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.discountType, language)}</Badge> },
    { header: "Value", headerAr: "القيمة", render: (r) => r.discountValue ?? "-" },
  ];

  return (
    <ResourceManager
      title="Unit Discounts"
      titleAr="خصومات الوحدات"
      columns={columns}
      fields={fields}
      useList={useListUnitDiscounts}
      useCreate={useCreateUnitDiscount}
      useUpdate={useUpdateUnitDiscount}
      useDelete={useDeleteUnitDiscount}
      getListQueryKey={getListUnitDiscountsQueryKey}
      companyId={companyId}
    />
  );
}
