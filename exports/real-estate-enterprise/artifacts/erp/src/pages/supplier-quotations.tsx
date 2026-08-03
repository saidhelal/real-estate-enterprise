import {
  useListSupplierQuotations,
  useCreateSupplierQuotation,
  useUpdateSupplierQuotation,
  useDeleteSupplierQuotation,
  getListSupplierQuotationsQueryKey,
  useListRfqs,
  useListSuppliers,
  useListCompanies,
  type SupplierQuotation,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function SupplierQuotationsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: rfqData } = useListRfqs({ pageSize: 200 });
  const rfqOptions = (rfqData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: supplierData } = useListSuppliers({ pageSize: 200 });
  const supplierOptions = (supplierData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "rfqId", label: "RFQ", labelAr: "طلب عرض السعر", type: "select", options: rfqOptions },
    { name: "supplierId", label: "Supplier", labelAr: "المورد", type: "select", options: supplierOptions },
    { name: "quotationNumber", label: "Quotation Number", labelAr: "رقم عرض السعر" },
    { name: "quotationDate", label: "Quotation Date", labelAr: "تاريخ العرض", type: "date" },
    { name: "validUntil", label: "Valid Until", labelAr: "صالح حتى", type: "date" },
    { name: "totalAmount", label: "Total Amount", labelAr: "المبلغ الإجمالي", type: "money" },
    { name: "technicalScore", label: "Technical Score", labelAr: "الدرجة الفنية", type: "number" },
    { name: "commercialScore", label: "Commercial Score", labelAr: "الدرجة التجارية", type: "number" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["received", "under_evaluation", "recommended", "awarded", "rejected"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<SupplierQuotation>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Total Amount", headerAr: "المبلغ الإجمالي", render: (r) => r.totalAmount ?? "-" },
  ];

  return (
    <ResourceManager
      title="Supplier Quotations"
      titleAr="عروض أسعار الموردين"
      columns={columns}
      fields={fields}
      useList={useListSupplierQuotations}
      useCreate={useCreateSupplierQuotation}
      useUpdate={useUpdateSupplierQuotation}
      useDelete={useDeleteSupplierQuotation}
      getListQueryKey={getListSupplierQuotationsQueryKey}
      companyId={companyId}
    />
  );
}
