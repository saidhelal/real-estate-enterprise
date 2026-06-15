import {
  useListPenalties,
  useCreatePenalty,
  useUpdatePenalty,
  useDeletePenalty,
  getListPenaltiesQueryKey,
  useCalculatePenalties,
  useListCompanies,
  type Penalty,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";

const STATUS = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "waived", label: "Waived" },
];

export default function PenaltiesPage() {
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const calculate = useCalculatePenalties();

  const fields: ResourceField[] = [
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "daysOverdue", label: "Days Overdue", labelAr: "أيام التأخير", type: "number" },
    { name: "assessedDate", label: "Assessed Date", labelAr: "تاريخ التقييم", type: "date", required: true },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", required: true, options: STATUS },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Penalty>[] = [
    { header: "Assessed Date", headerAr: "تاريخ التقييم", render: (r) => r.assessedDate },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount },
    { header: "Days Overdue", headerAr: "أيام التأخير", render: (r) => r.daysOverdue },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{r.status}</Badge> },
  ];

  const handleCalculate = () => {
    calculate.mutate(
      { data: companyId ? { companyId } : {} },
      {
        onSuccess: (res) => {
          toast({
            title: language === "ar" ? "تم احتساب الغرامات" : "Penalties calculated",
            description:
              language === "ar"
                ? `${res.created} غرامة بإجمالي ${res.totalAmount ?? "0"}`
                : `${res.created} created, total ${res.totalAmount ?? "0"}`,
          });
          queryClient.invalidateQueries({ queryKey: getListPenaltiesQueryKey() });
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleCalculate} disabled={calculate.isPending}>
          <Calculator className="mr-2 h-4 w-4" />
          {language === "ar" ? "احتساب الغرامات" : "Calculate Penalties"}
        </Button>
      </div>
      <ResourceManager
        title="Penalties"
        titleAr="الغرامات"
        columns={columns}
        fields={fields}
        useList={useListPenalties}
        useCreate={useCreatePenalty}
        useUpdate={useUpdatePenalty}
        useDelete={useDeletePenalty}
        getListQueryKey={getListPenaltiesQueryKey}
        companyId={companyId}
        searchable={false}
        canCreate={false}
      />
    </div>
  );
}
