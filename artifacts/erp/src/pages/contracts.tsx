import {
  useListContracts,
  useCreateContract,
  useUpdateContract,
  useDeleteContract,
  getListContractsQueryKey,
  useListBranches,
  useListReservations,
  useListProjects,
  useListPhases,
  useListBuildings,
  useListFloors,
  useListUnits,
  useListUnitStatuses,
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
  const { data: projects } = useListProjects({ pageSize: 200 });
  const { data: phases } = useListPhases({ pageSize: 200 });
  const { data: buildings } = useListBuildings({ pageSize: 200 });
  const { data: floors } = useListFloors({ pageSize: 200 });
  const { data: units } = useListUnits({ pageSize: 200 });
  const { data: unitStatuses } = useListUnitStatuses({ pageSize: 200 });
  const { data: customers } = useListCustomers({ pageSize: 200 });
  const companyId = companies?.[0]?.id;

  // Map unitStatusId -> status code so only reserved units are selectable for a
  // contract (the server enforces the same rule); other units render but are
  // disabled so an existing contract's unit still shows on edit.
  const statusCodeById = new Map((unitStatuses?.data ?? []).map((s) => [s.id, s.code]));

  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));
  const reservationOptions = (reservations?.data ?? []).map((r) => ({ value: r.id, label: r.code }));
  const projectOptions = (projects?.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const phaseOptions = (phases?.data ?? []).map((p) => ({ value: p.id, label: p.name, parentValue: p.projectId }));
  const buildingOptions = (buildings?.data ?? []).map((b) => ({ value: b.id, label: b.name, parentValue: b.projectId, parentValues: { projectId: b.projectId, phaseId: b.phaseId ?? null } }));
  const floorOptions = (floors?.data ?? []).map((f) => ({ value: f.id, label: f.name, parentValue: f.buildingId }));
  const unitOptions = (units?.data ?? []).map((u) => ({
    value: u.id,
    label: u.name,
    parentValue: u.floorId,
    disabled: (u.unitStatusId ? statusCodeById.get(u.unitStatusId) : undefined) !== "reserved",
  }));
  const customerOptions = (customers?.data ?? []).map((c) => ({ value: c.id, label: c.fullName }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "branchId", label: "Branch", labelAr: "الفرع", type: "select", options: branchOptions },
    { name: "reservationId", label: "Reservation", labelAr: "الحجز", type: "select", searchable: true, options: reservationOptions },
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", searchable: true, filterOnly: true, options: projectOptions },
    { name: "phaseId", label: "Phase", labelAr: "المرحلة", type: "select", searchable: true, filterOnly: true, dependsOn: "projectId", options: phaseOptions },
    { name: "buildingId", label: "Building", labelAr: "المبنى", type: "select", searchable: true, filterOnly: true, dependsOn: ["projectId", "phaseId"], options: buildingOptions },
    { name: "floorId", label: "Floor", labelAr: "الطابق", type: "select", searchable: true, filterOnly: true, dependsOn: "buildingId", options: floorOptions },
    { name: "unitId", label: "Unit", labelAr: "الوحدة", type: "select", required: true, searchable: true, dependsOn: "floorId", options: unitOptions },
    { name: "customerId", label: "Customer", labelAr: "العميل", type: "select", required: true, searchable: true, options: customerOptions },
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
