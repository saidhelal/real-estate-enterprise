import {
  useListReservations,
  useCreateReservation,
  useUpdateReservation,
  useDeleteReservation,
  getListReservationsQueryKey,
  useConvertReservation,
  useListBranches,
  useListProjects,
  useListPhases,
  useListBuildings,
  useListFloors,
  useListUnits,
  useListUnitStatuses,
  useListCustomers,
  useListCompanies,
  type Reservation,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileSignature } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import { getListContractsQueryKey } from "@workspace/api-client-react";

export default function ReservationsPage() {
  const { language, t } = useLanguage();
  const STATUS = enumOptions(["active", "converted", "cancelled", "expired"]);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: companies } = useListCompanies();
  const { data: branches } = useListBranches();
  const { data: projects } = useListProjects({ pageSize: 200 });
  const { data: phases } = useListPhases({ pageSize: 200 });
  const { data: buildings } = useListBuildings({ pageSize: 200 });
  const { data: floors } = useListFloors({ pageSize: 200 });
  const { data: units } = useListUnits({ pageSize: 200 });
  const { data: unitStatuses } = useListUnitStatuses({ pageSize: 200 });
  const { data: customers } = useListCustomers({ pageSize: 200 });
  const companyId = companies?.[0]?.id;
  const convert = useConvertReservation();

  // Map unitStatusId -> status code so units that are not available can be shown
  // (so an existing reservation's unit still renders on edit) but not selected.
  const statusCodeById = new Map((unitStatuses?.data ?? []).map((s) => [s.id, s.code]));

  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));
  const projectOptions = (projects?.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const phaseOptions = (phases?.data ?? []).map((p) => ({ value: p.id, label: p.name, parentValue: p.projectId }));
  const buildingOptions = (buildings?.data ?? []).map((b) => ({ value: b.id, label: b.name, parentValue: b.projectId, parentValues: { projectId: b.projectId, phaseId: b.phaseId ?? null } }));
  const floorOptions = (floors?.data ?? []).map((f) => ({ value: f.id, label: f.name, parentValue: f.buildingId }));
  const unitOptions = (units?.data ?? []).map((u) => ({
    value: u.id,
    label: u.name,
    parentValue: u.floorId,
    disabled: (u.unitStatusId ? statusCodeById.get(u.unitStatusId) : undefined) !== "available",
  }));
  const customerOptions = (customers?.data ?? []).map((c) => ({ value: c.id, label: c.fullName }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "branchId", label: "Branch", labelAr: "الفرع", type: "select", options: branchOptions },
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", searchable: true, filterOnly: true, options: projectOptions },
    { name: "phaseId", label: "Phase", labelAr: "المرحلة", type: "select", searchable: true, filterOnly: true, dependsOn: "projectId", options: phaseOptions },
    { name: "buildingId", label: "Building", labelAr: "المبنى", type: "select", searchable: true, filterOnly: true, dependsOn: ["projectId", "phaseId"], options: buildingOptions },
    { name: "floorId", label: "Floor", labelAr: "الطابق", type: "select", searchable: true, filterOnly: true, dependsOn: "buildingId", options: floorOptions },
    { name: "unitId", label: "Unit", labelAr: "الوحدة", type: "select", required: true, searchable: true, dependsOn: "floorId", options: unitOptions },
    { name: "customerId", label: "Customer", labelAr: "العميل", type: "select", required: true, searchable: true, options: customerOptions },
    { name: "reservationDate", label: "Reservation Date", labelAr: "تاريخ الحجز", type: "date", required: true },
    { name: "expiryDate", label: "Expiry Date", labelAr: "تاريخ الانتهاء", type: "date" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", required: true, options: STATUS },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Reservation>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Date", headerAr: "التاريخ", render: (r) => r.reservationDate },
    { header: "Expiry", headerAr: "الانتهاء", render: (r) => r.expiryDate ?? "-" },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  const handleConvert = (r: Reservation) => {
    const label = language === "ar" ? "تحويل الحجز إلى عقد؟" : "Convert this reservation into a contract?";
    if (!confirm(label)) return;
    convert.mutate(
      { id: r.id, data: {} },
      {
        onSuccess: (contract) => {
          toast({
            title: language === "ar" ? "تم إنشاء العقد" : "Contract created",
            description: contract?.code,
          });
          queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  return (
    <ResourceManager
      title="Reservations"
      titleAr="الحجوزات"
      columns={columns}
      fields={fields}
      useList={useListReservations}
      useCreate={useCreateReservation}
      useUpdate={useUpdateReservation}
      useDelete={useDeleteReservation}
      getListQueryKey={getListReservationsQueryKey}
      companyId={companyId}
      rowActions={(r) =>
        r.status === "active" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={convert.isPending}
            onClick={() => handleConvert(r)}
            title={language === "ar" ? "تحويل إلى عقد" : "Convert to contract"}
          >
            <FileSignature className="h-4 w-4 mr-1" />
            {language === "ar" ? "تحويل" : "Convert"}
          </Button>
        ) : null
      }
    />
  );
}
