import {
  useListContractorInvoices,
  useCreateContractorInvoice,
  useUpdateContractorInvoice,
  useDeleteContractorInvoice,
  getListContractorInvoicesQueryKey,
  useListContractorContracts,
  useListPaymentCertificates,
  useListCompanies,
  type ContractorInvoice,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function ContractorInvoicesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: contractData } = useListContractorContracts({ pageSize: 200 });
  const contractOptions = (contractData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: certificateData } = useListPaymentCertificates({ pageSize: 200 });
  const certificateOptions = (certificateData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", options: contractOptions },
    { name: "certificateId", label: "Certificate", labelAr: "الشهادة", type: "select", options: certificateOptions },
    { name: "invoiceNumber", label: "Invoice Number", labelAr: "رقم الفاتورة" },
    { name: "invoiceDate", label: "Invoice Date", labelAr: "تاريخ الفاتورة", type: "date" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["registered", "verified", "approved", "paid"]) },
    { name: "verifiedBy", label: "Verified By", labelAr: "تحقق بواسطة" },
    { name: "approvedBy", label: "Approved By", labelAr: "اعتمد بواسطة" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<ContractorInvoice>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount ?? "-" },
  ];

  return (
    <ResourceManager
      title="Contractor Invoices"
      titleAr="فواتير المقاول"
      columns={columns}
      fields={fields}
      useList={useListContractorInvoices}
      useCreate={useCreateContractorInvoice}
      useUpdate={useUpdateContractorInvoice}
      useDelete={useDeleteContractorInvoice}
      getListQueryKey={getListContractorInvoicesQueryKey}
      companyId={companyId}
    />
  );
}
