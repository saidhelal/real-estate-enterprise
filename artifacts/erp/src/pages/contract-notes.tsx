import {
  useListContractNotes,
  useCreateContractNote,
  useUpdateContractNote,
  useDeleteContractNote,
  getListContractNotesQueryKey,
  useListContracts,
  useListUsers,
  useListCompanies,
  type ContractNote,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";

export default function ContractNotesPage() {
  const { data: companies } = useListCompanies();
  const { data: contracts } = useListContracts({ pageSize: 200 });
  const { data: users } = useListUsers();
  const companyId = companies?.[0]?.id;
  const contractOptions = (contracts?.data ?? []).map((c) => ({ value: c.id, label: c.code }));
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.fullName ?? u.username }));

  const fields: ResourceField[] = [
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", required: true, options: contractOptions },
    { name: "userId", label: "User", labelAr: "المستخدم", type: "select", options: userOptions },
    { name: "note", label: "Note", labelAr: "ملاحظة", type: "textarea", required: true },
  ];

  const columns: ResourceColumn<ContractNote>[] = [
    { header: "Note", headerAr: "ملاحظة", render: (r) => <span className="font-medium">{r.note}</span> },
  ];

  return (
    <ResourceManager
      title="Contract Notes"
      titleAr="ملاحظات العقود"
      columns={columns}
      fields={fields}
      useList={useListContractNotes}
      useCreate={useCreateContractNote}
      useUpdate={useUpdateContractNote}
      useDelete={useDeleteContractNote}
      getListQueryKey={getListContractNotesQueryKey}
      companyId={companyId}
    />
  );
}
