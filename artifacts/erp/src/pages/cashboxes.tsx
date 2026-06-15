import {
  useListCashboxes,
  useCreateCashbox,
  useUpdateCashbox,
  useDeleteCashbox,
  getListCashboxesQueryKey,
  useListCompanies,
  type Cashbox,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const STATUS = enumOptions(["active", "inactive", "closed"]);

export default function CashboxesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Arabic Name", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "openingBalance", label: "Opening Balance", labelAr: "الرصيد الافتتاحي", type: "money" },
    { name: "currentBalance", label: "Current Balance", labelAr: "الرصيد الحالي", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", required: true, options: STATUS },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Cashbox>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => r.name },
    { header: "Current Balance", headerAr: "الرصيد الحالي", render: (r) => r.currentBalance },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Cashboxes"
      titleAr="الخزائن"
      columns={columns}
      fields={fields}
      useList={useListCashboxes}
      useCreate={useCreateCashbox}
      useUpdate={useUpdateCashbox}
      useDelete={useDeleteCashbox}
      getListQueryKey={getListCashboxesQueryKey}
      companyId={companyId}
    />
  );
}
