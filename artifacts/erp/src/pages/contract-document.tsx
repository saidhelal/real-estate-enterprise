import type { ReactNode } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetContract,
  getGetContractQueryKey,
  useListCustomers,
  useListUnits,
  useListCompanies,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";
import { useDeclareScreenContext } from "@/lib/screen-context";
import { Printer, ArrowLeft } from "lucide-react";

export default function ContractDocumentPage() {
  const { language, t } = useLanguage();
  const [, params] = useRoute("/contracts/:id/document");
  const id = params?.id ?? "";

  const { data: contract, isLoading } = useGetContract(id, {
    query: { enabled: !!id, queryKey: getGetContractQueryKey(id) },
  });
  const { data: companies } = useListCompanies();
  const { data: customers } = useListCustomers({ pageSize: 200 });
  const { data: units } = useListUnits({ pageSize: 200 });

  // Tells the header what is on screen, so its print menu offers the contract
  // templates and a directive raised here carries the contract. Declared above
  // the loading and error returns: a hook has to run on every render, and the
  // fields are optional precisely so it can run before the data arrives.
  useDeclareScreenContext({
    moduleKey: "sales",
    documentType: "contract",
    entityId: contract?.id,
    label: contract?.code ? `${t("nav.contracts")} ${contract.code}` : undefined,
    documentNumber: contract?.code ?? undefined,
  });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p>;
  if (!contract) return <p className="p-6 text-sm text-muted-foreground">{t("common.error")}</p>;

  const ar = language === "ar";
  const company = companies?.find((c) => c.id === contract.companyId);
  const customer = customers?.data.find((c) => c.id === contract.customerId);
  const unit = units?.data.find((u) => u.id === contract.unitId);
  const isActive = contract.status === "active";
  const companyName = company ? (ar ? company.nameAr : company.name) : "";

  const row = (label: string, value: ReactNode) => (
    <div className="flex justify-between gap-4 border-b border-dashed py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-end">{value ?? "-"}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/contracts">
            <ArrowLeft className="h-4 w-4 me-1" />
            {ar ? "العقود" : "Contracts"}
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 me-1" />
          {ar ? "طباعة" : "Print"}
        </Button>
      </div>

      {/*
        Everything inside this element is deliberately outside the theme.
        It is a sheet of paper: it renders white in dark mode too, and it is
        what the printer puts on A4. The literal greens and greys below are
        therefore correct and must NOT be swapped for design tokens — a token
        would flip with the theme and leave light-grey text on a white page.
      */}
      <div
        dir={ar ? "rtl" : "ltr"}
        className="relative mx-auto w-full max-w-[800px] rounded-lg border bg-white p-10 text-black shadow-sm dark:bg-white"
      >
        {!isActive ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <span className="rotate-[-30deg] select-none text-[120px] font-extrabold uppercase tracking-widest text-red-500/15">
              {ar ? "مسودة" : "DRAFT"}
            </span>
          </div>
        ) : null}

        <div className="relative">
          <div className="mb-6 text-center">
            <PageHeader title={companyName} bordered={false} />
            <p className="text-sm text-gray-600">{ar ? "عقد بيع وحدة عقارية" : "Real Estate Unit Sale Contract"}</p>
          </div>

          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="font-semibold">{ar ? "رقم العقد" : "Contract No."}: {contract.code}</span>
            <span>{ar ? "الحالة" : "Status"}: {enumLabel(contract.status, language)}</span>
          </div>

          <section className="mb-4 text-sm">
            <h2 className="mb-1 font-semibold">{ar ? "بيانات العقد" : "Contract Details"}</h2>
            {row(ar ? "العميل" : "Customer", customer ? (ar ? customer.nameAr ?? customer.fullName : customer.fullName) : contract.customerId)}
            {row(ar ? "الوحدة" : "Unit", unit?.code ?? contract.unitId)}
            {row(ar ? "تاريخ العقد" : "Contract Date", contract.contractDate)}
            {row(ar ? "القيمة الإجمالية" : "Total Price", contract.totalPrice)}
            {row(ar ? "الدفعة المقدمة" : "Down Payment", contract.downPayment ?? "-")}
            {row(ar ? "طريقة الدفع" : "Payment Method", enumLabel(contract.paymentMethod, language))}
          </section>

          {isActive ? (
            <section className="mt-8 rounded-md border border-green-600/40 bg-green-50 p-4 text-sm">
              <h2 className="mb-1 font-semibold text-green-800">{ar ? "وثيقة معتمدة" : "Verified Document"}</h2>
              {row(ar ? "رمز التحقق" : "Verification ID", <span className="font-mono">{contract.verificationId ?? "-"}</span>)}
              {row(ar ? "تاريخ الاعتماد القانوني" : "Legal Approval", contract.legalApprovedAt ? new Date(contract.legalApprovedAt).toLocaleString() : "-")}
            </section>
          ) : (
            <p className="mt-8 text-center text-sm text-gray-500">
              {ar
                ? "هذه نسخة مسودة غير معتمدة — تصبح الوثيقة رسمية بعد الاعتماد القانوني والتفعيل."
                : "This is an unapproved draft — the document becomes official after legal approval and activation."}
            </p>
          )}

          <div className="mt-10 grid grid-cols-3 gap-4 text-center text-xs text-gray-600">
            <div className="border-t pt-2">{ar ? "المبيعات" : "Sales"}</div>
            <div className="border-t pt-2">{ar ? "المالية" : "Finance"}</div>
            <div className="border-t pt-2">{ar ? "الشؤون القانونية" : "Legal"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
