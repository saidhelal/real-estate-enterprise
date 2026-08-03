import {
  useListContractCancellations,
  useCreateContractCancellation,
  useUpdateContractCancellation,
  useDeleteContractCancellation,
  getListContractCancellationsQueryKey,
  useListContracts,
  useListUsers,
  useListCompanies,
  type ContractCancellation,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function ContractCancellationsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const { data: contracts } = useListContracts({ pageSize: 200 });
  const { data: users } = useListUsers();
  const companyId = companies?.[0]?.id;

  const contractOptions = (contracts?.data ?? []).map((c) => ({ value: c.id, label: c.code }));
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.fullName ?? u.username }));

  const fields: ResourceField[] = [
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", required: true, options: contractOptions },
    { name: "cancellationDate", label: "Cancellation Date", labelAr: "تاريخ الإلغاء", type: "date", required: true },
    { name: "reason", label: "Reason", labelAr: "السبب", type: "textarea" },
    { name: "refundAmount", label: "Refund Amount", labelAr: "مبلغ الاسترداد", type: "money" },
    { name: "penaltyAmount", label: "Penalty Amount", labelAr: "مبلغ الغرامة", type: "money" },
    { name: "userId", label: "User", labelAr: "المستخدم", type: "select", options: userOptions },
  ];

  const columns: ResourceColumn<ContractCancellation>[] = [
    { header: "Date", headerAr: "التاريخ", render: (r) => r.cancellationDate },
    { header: "Reason", headerAr: "السبب", render: (r) => r.reason ?? "-" },
    { header: "Refund", headerAr: "الاسترداد", render: (r) => r.refundAmount ?? "-" },
    { header: "Penalty", headerAr: "الغرامة", render: (r) => r.penaltyAmount ?? "-" },
  ];

  return (
    <ResourceManager
      title="Contract Cancellations"
      titleAr="إلغاء العقود"
      columns={columns}
      fields={fields}
      useList={useListContractCancellations}
      useCreate={useCreateContractCancellation}
      useUpdate={useUpdateContractCancellation}
      useDelete={useDeleteContractCancellation}
      getListQueryKey={getListContractCancellationsQueryKey}
      companyId={companyId}
    />
  );
}
