import {
  useListContractAmendments,
  useCreateContractAmendment,
  useUpdateContractAmendment,
  useDeleteContractAmendment,
  getListContractAmendmentsQueryKey,
  useListContracts,
  useListUsers,
  useListCompanies,
  type ContractAmendment,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function ContractAmendmentsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const { data: contracts } = useListContracts({ pageSize: 200 });
  const { data: users } = useListUsers();
  const companyId = companies?.[0]?.id;

  const contractOptions = (contracts?.data ?? []).map((c) => ({ value: c.id, label: c.code }));
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.fullName ?? u.username }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Code",
      labelAr: "الرمز",
      // Issued by the central sequence engine on save; shown in the form
      // before saving and never typed in.
      generated: true,
      generatorKey: "contractAmendment",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", required: true, options: contractOptions },
    { name: "amendmentDate", label: "Amendment Date", labelAr: "تاريخ التعديل", type: "date", required: true },
    { name: "description", label: "Description", labelAr: "الوصف", required: true },
    { name: "oldValue", label: "Old Value", labelAr: "القيمة القديمة" },
    { name: "newValue", label: "New Value", labelAr: "القيمة الجديدة" },
    { name: "userId", label: "User", labelAr: "المستخدم", type: "select", options: userOptions },
  ];

  const columns: ResourceColumn<ContractAmendment>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Date", headerAr: "التاريخ", render: (r) => r.amendmentDate },
    { header: "Description", headerAr: "الوصف", render: (r) => r.description },
  ];

  return (
    <ResourceManager
      title="Contract Amendments"
      titleAr="تعديلات العقود"
      columns={columns}
      fields={fields}
      useList={useListContractAmendments}
      useCreate={useCreateContractAmendment}
      useUpdate={useUpdateContractAmendment}
      useDelete={useDeleteContractAmendment}
      getListQueryKey={getListContractAmendmentsQueryKey}
      companyId={companyId}
    />
  );
}
