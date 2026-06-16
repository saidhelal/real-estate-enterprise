import {
  useListEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  getListEmployeesQueryKey,
  useListDepartments,
  useListJobTitles,
  useListCompanies,
  type Employee,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const EMPLOYMENT_TYPE = enumOptions(["full_time", "part_time", "contract", "temporary", "intern"]);
const GENDER = enumOptions(["male", "female"]);
const MARITAL = enumOptions(["single", "married", "divorced", "widowed"]);
const STATUS = enumOptions(["active", "on_leave", "suspended", "terminated", "resigned"]);

export default function EmployeesPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: departments } = useListDepartments({ pageSize: 200 });
  const { data: jobTitles } = useListJobTitles({ pageSize: 200 });

  const departmentOptions = (departments?.data ?? []).map((d) => ({ value: d.id, label: d.name, labelAr: d.nameAr }));
  const jobTitleOptions = (jobTitles?.data ?? []).map((j) => ({ value: j.id, label: j.name, labelAr: j.nameAr }));
  const departmentName = (id: string | null | undefined) => {
    const d = (departments?.data ?? []).find((x) => x.id === id);
    return d ? (language === "ar" ? d.nameAr : d.name) : "-";
  };

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "firstName", label: t("hr.first_name"), required: true },
    { name: "lastName", label: t("hr.last_name"), required: true },
    { name: "firstNameAr", label: t("hr.first_name_ar"), rtl: true },
    { name: "lastNameAr", label: t("hr.last_name_ar"), rtl: true },
    { name: "gender", label: t("hr.gender"), type: "select", options: GENDER },
    { name: "maritalStatus", label: t("hr.marital_status"), type: "select", options: MARITAL },
    { name: "dateOfBirth", label: t("hr.date_of_birth"), type: "date" },
    { name: "nationality", label: t("hr.nationality") },
    { name: "nationalId", label: t("hr.national_id") },
    { name: "email", label: t("hr.email") },
    { name: "phone", label: t("hr.phone") },
    { name: "departmentId", label: t("nav.departments"), type: "select", options: departmentOptions },
    { name: "jobTitleId", label: t("nav.job_titles"), type: "select", options: jobTitleOptions },
    { name: "employmentType", label: t("hr.employment_type"), type: "select", options: EMPLOYMENT_TYPE },
    { name: "hireDate", label: t("hr.hire_date"), type: "date" },
    { name: "basicSalary", label: t("hr.basic_salary"), type: "money" },
    { name: "bankName", label: t("hr.bank_name") },
    { name: "iban", label: t("hr.iban") },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
    { name: "notes", label: t("common.notes"), type: "textarea" },
  ];

  const columns: ResourceColumn<Employee>[] = [
    { header: t("common.code"), render: (r) => r.code },
    {
      header: t("common.name"),
      render: (r) =>
        language === "ar" && r.firstNameAr
          ? `${r.firstNameAr} ${r.lastNameAr ?? ""}`.trim()
          : `${r.firstName} ${r.lastName}`,
    },
    { header: t("nav.departments"), render: (r) => departmentName(r.departmentId) },
    { header: t("hr.employment_type"), render: (r) => enumLabel(r.employmentType, language) },
    { header: t("hr.basic_salary"), render: (r) => r.basicSalary },
    {
      header: t("common.status"),
      render: (r) => (
        <Badge variant={r.status === "active" ? "secondary" : "outline"}>
          {enumLabel(r.status, language)}
        </Badge>
      ),
    },
  ];

  return (
    <ResourceManager
      title={t("nav.employees")}
      columns={columns}
      fields={fields}
      useList={useListEmployees}
      useCreate={useCreateEmployee}
      useUpdate={useUpdateEmployee}
      useDelete={useDeleteEmployee}
      getListQueryKey={getListEmployeesQueryKey}
      companyId={companyId}
    />
  );
}
