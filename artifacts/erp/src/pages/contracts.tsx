import {
  useListContracts,
  useCreateContract,
  useUpdateContract,
  useDeleteContract,
  getListContractsQueryKey,
  useListBranches,
  useListReservations,
  useListUnits,
  useListCustomers,
  useListCompanies,
  type Contract,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { DocumentsRowAction } from "@/components/documents/documents-row-action";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const STATUS = enumOptions(["draft", "active", "completed", "cancelled"]);

export default function ContractsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: branches } = useListBranches();
  const { data: reservations } = useListReservations({ pageSize: 200 });
  const { data: units } = useListUnits({ pageSize: 200 });
  const { data: customers } = useListCustomers({ pageSize: 200 });
  const companyId = companies?.[0]?.id;

  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));
  const reservationOptions = (reservations?.data ?? []).map((r) => ({ value: r.id, label: r.code }));
  const unitOptions = (units?.data ?? []).map((u) => ({ value: u.id, label: u.name }));
  const customerOptions = (customers?.data ?? []).map((c) => ({ value: c.id, label: c.fullName }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "branchId", label: "Branch", labelAr: "الفرع", type: "select", options: branchOptions },
    { name: "reservationId", label: "Reservation", labelAr: "الحجز", type: "select", options: reservationOptions },
    { name: "unitId", label: "Unit", labelAr: "الوحدة", type: "select", required: true, options: unitOptions },
    { name: "customerId", label: "Customer", labelAr: "العميل", type: "select", required: true, options: customerOptions },
    { name: "contractDate", label: "Contract Date", labelAr: "تاريخ العقد", type: "date", required: true },
    { name: "totalPrice", label: "Total Price", labelAr: "السعر الإجمالي", type: "money" },
    { name: "downPayment", label: "Down Payment", labelAr: "الدفعة المقدمة", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", required: true, options: STATUS },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Contract>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Date", headerAr: "التاريخ", render: (r) => r.contractDate },
    { header: "Total Price", headerAr: "السعر الإجمالي", render: (r) => r.totalPrice ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Contracts"
      titleAr="العقود"
      columns={columns}
      fields={fields}
      useList={useListContracts}
      useCreate={useCreateContract}
      useUpdate={useUpdateContract}
      useDelete={useDeleteContract}
      getListQueryKey={getListContractsQueryKey}
      companyId={companyId}
      rowActions={(r) => <DocumentsRowAction moduleKey="contracts" sourceId={r.id} />}
    />
  );
}
