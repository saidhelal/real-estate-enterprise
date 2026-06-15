import {
  useListInstallmentPlans,
  useCreateInstallmentPlan,
  useUpdateInstallmentPlan,
  useDeleteInstallmentPlan,
  getListInstallmentPlansQueryKey,
  useGenerateInstallmentSchedules,
  getListInstallmentSchedulesQueryKey,
  useListContracts,
  useListCompanies,
  type InstallmentPlan,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";

const FREQUENCY = enumOptions(["monthly", "quarterly", "semi_annual", "annual", "custom"]);

const STATUS = enumOptions(["active", "completed", "cancelled"]);

export default function InstallmentPlansPage() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: companies } = useListCompanies();
  const { data: contracts } = useListContracts({ pageSize: 200 });
  const companyId = companies?.[0]?.id;
  const contractOptions = (contracts?.data ?? []).map((c) => ({ value: c.id, label: c.code }));
  const generate = useGenerateInstallmentSchedules();

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", required: true, options: contractOptions },
    { name: "totalAmount", label: "Total Amount", labelAr: "المبلغ الإجمالي", type: "money" },
    { name: "downPayment", label: "Down Payment", labelAr: "الدفعة المقدمة", type: "money" },
    { name: "numberOfInstallments", label: "Number of Installments", labelAr: "عدد الأقساط", type: "number" },
    { name: "frequency", label: "Frequency", labelAr: "التكرار", type: "select", required: true, options: FREQUENCY },
    { name: "startDate", label: "Start Date", labelAr: "تاريخ البدء", type: "date", required: true },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", required: true, options: STATUS },
  ];

  const columns: ResourceColumn<InstallmentPlan>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Total Amount", headerAr: "المبلغ الإجمالي", render: (r) => r.totalAmount },
    { header: "Installments", headerAr: "الأقساط", render: (r) => r.numberOfInstallments },
    { header: "Frequency", headerAr: "التكرار", render: (r) => enumLabel(r.frequency, language) },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  const handleGenerate = (r: InstallmentPlan) => {
    const label =
      language === "ar"
        ? "إنشاء جدول الأقساط لهذه الخطة؟"
        : "Generate the installment schedule for this plan?";
    if (!confirm(label)) return;
    generate.mutate(
      { id: r.id },
      {
        onSuccess: (res) => {
          toast({
            title: language === "ar" ? "تم إنشاء الأقساط" : "Schedules generated",
            description:
              language === "ar"
                ? `${res?.created ?? 0} قسط`
                : `${res?.created ?? 0} installments created`,
          });
          queryClient.invalidateQueries({ queryKey: getListInstallmentSchedulesQueryKey() });
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  return (
    <ResourceManager
      title="Installment Plans"
      titleAr="خطط الأقساط"
      columns={columns}
      fields={fields}
      useList={useListInstallmentPlans}
      useCreate={useCreateInstallmentPlan}
      useUpdate={useUpdateInstallmentPlan}
      useDelete={useDeleteInstallmentPlan}
      getListQueryKey={getListInstallmentPlansQueryKey}
      companyId={companyId}
      rowActions={(r) => (
        <Button
          variant="outline"
          size="sm"
          disabled={generate.isPending}
          onClick={() => handleGenerate(r)}
          title={language === "ar" ? "إنشاء الأقساط" : "Generate schedules"}
        >
          <ListPlus className="h-4 w-4 mr-1" />
          {language === "ar" ? "إنشاء" : "Generate"}
        </Button>
      )}
    />
  );
}
