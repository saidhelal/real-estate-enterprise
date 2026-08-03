import {
  useListDrivers,
  useCreateDriver,
  useUpdateDriver,
  useDeleteDriver,
  getListDriversQueryKey,
  useListCompanies,
  type Driver,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function DriversPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "fullName", label: "Full Name", labelAr: "الاسم الكامل", required: true },
    { name: "employeeId", label: "Employee ID", labelAr: "معرّف الموظف" },
    { name: "licenseNumber", label: "License Number", labelAr: "رقم الرخصة" },
    { name: "licenseType", label: "License Type", labelAr: "نوع الرخصة" },
    { name: "licenseExpiry", label: "License Expiry", labelAr: "انتهاء الرخصة", type: "date" },
    { name: "phone", label: "Phone", labelAr: "الهاتف" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["active", "inactive", "suspended"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Driver>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Full Name", headerAr: "الاسم", render: (r) => r.fullName },
    { header: "Phone", headerAr: "الهاتف", render: (r) => r.phone ?? "—" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Drivers"
      titleAr="السائقون"
      columns={columns}
      fields={fields}
      useList={useListDrivers}
      useCreate={useCreateDriver}
      useUpdate={useUpdateDriver}
      useDelete={useDeleteDriver}
      getListQueryKey={getListDriversQueryKey}
      companyId={companyId}
    />
  );
}
