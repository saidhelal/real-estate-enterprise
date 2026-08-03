import {
  useListContracts,
  useCreateContract,
  useUpdateContract,
  useDeleteContract,
  getListContractsQueryKey,
  useSubmitContractToFinance,
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
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Send, FileText } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language-provider";

const STATUS = enumOptions([
  "draft",
  "pending_finance",
  "finance_approved",
  "active",
  "rejected",
  "completed",
  "cancelled",
]);

const PAYMENT_METHODS = enumOptions(["cash", "cheque", "installments", "bank_transfer"]);

export default function ContractsPage() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const submitToFinance = useSubmitContractToFinance();
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
    { name: "paymentMethod", label: "Payment Method", labelAr: "طريقة الدفع", type: "select", options: PAYMENT_METHODS },
    // Status is driven by the approval workflow (Submit to Finance -> Finance
    // approval -> Legal activation), not edited by hand; shown read-only as a
    // filter so it cannot be manually flipped to bypass the workflow.
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", filterOnly: true, options: STATUS },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Contract>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Date", headerAr: "التاريخ", render: (r) => r.contractDate },
    { header: "Total Price", headerAr: "السعر الإجمالي", render: (r) => r.totalPrice ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant={statusVariant(r.status)}>{enumLabel(r.status, language)}</Badge> },
  ];

  const handleSubmit = (r: Contract) => {
    const label = language === "ar"
      ? "إرسال هذا العقد إلى المالية للاعتماد؟"
      : "Submit this contract to Finance for approval?";
    if (!confirm(label)) return;
    submitToFinance.mutate(
      { id: r.id, data: {} },
      {
        onSuccess: () => {
          toast({ title: language === "ar" ? "أُرسل إلى المالية" : "Submitted to Finance", description: r.code });
          queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

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
      rowActions={(r) => (
        <div className="flex items-center gap-1">
          {r.status === "draft" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={submitToFinance.isPending}
              onClick={() => handleSubmit(r)}
              title={language === "ar" ? "إرسال إلى المالية" : "Submit to Finance"}
            >
              <Send className="h-4 w-4 mr-1" />
              {language === "ar" ? "إلى المالية" : "To Finance"}
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="sm" title={language === "ar" ? "مستند العقد" : "Contract document"}>
            <Link href={`/contracts/${r.id}/document`}>
              <FileText className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    />
  );
}

function statusVariant(status: string | null | undefined): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "rejected":
    case "cancelled":
      return "destructive";
    case "pending_finance":
    case "finance_approved":
      return "outline";
    default:
      return "secondary";
  }
}
