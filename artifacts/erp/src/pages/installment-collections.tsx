import {
  useListInstallmentCollections,
  useCreateInstallmentCollection,
  useUpdateInstallmentCollection,
  useDeleteInstallmentCollection,
  getListInstallmentCollectionsQueryKey,
  useListInstallmentSchedules,
  useListUsers,
  useListCompanies,
  type InstallmentCollection,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const METHOD = enumOptions(["cash", "bank_transfer", "cheque", "card"]);

export default function InstallmentCollectionsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: schedules } = useListInstallmentSchedules({ pageSize: 200 });
  const { data: users } = useListUsers();
  const companyId = companies?.[0]?.id;
  const scheduleOptions = (schedules?.data ?? []).map((s) => ({
    value: s.id,
    label: `#${s.installmentNumber} - ${s.dueDate}`,
  }));
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.fullName ?? u.username }));

  const fields: ResourceField[] = [
    { name: "scheduleId", label: "Schedule", labelAr: "الجدول", type: "select", required: true, options: scheduleOptions },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "collectionDate", label: "Collection Date", labelAr: "تاريخ التحصيل", type: "date", required: true },
    { name: "method", label: "Method", labelAr: "طريقة الدفع", type: "select", required: true, options: METHOD },
    { name: "reference", label: "Reference", labelAr: "المرجع" },
    { name: "userId", label: "User", labelAr: "المستخدم", type: "select", options: userOptions },
  ];

  const columns: ResourceColumn<InstallmentCollection>[] = [
    { header: "Amount", headerAr: "المبلغ", render: (r) => <span className="font-medium">{r.amount}</span> },
    { header: "Collection Date", headerAr: "تاريخ التحصيل", render: (r) => r.collectionDate },
    { header: "Method", headerAr: "طريقة الدفع", render: (r) => <Badge variant="secondary">{enumLabel(r.method, language)}</Badge> },
    { header: "Reference", headerAr: "المرجع", render: (r) => r.reference ?? "-" },
  ];

  return (
    <ResourceManager
      title="Installment Collections"
      titleAr="تحصيلات الأقساط"
      columns={columns}
      fields={fields}
      useList={useListInstallmentCollections}
      useCreate={useCreateInstallmentCollection}
      useUpdate={useUpdateInstallmentCollection}
      useDelete={useDeleteInstallmentCollection}
      getListQueryKey={getListInstallmentCollectionsQueryKey}
      companyId={companyId}
    />
  );
}
