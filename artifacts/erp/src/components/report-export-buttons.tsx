import { useRecordReportExport } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth-provider";
import { useLanguage } from "@/lib/language-provider";
import {
  exportReportToExcel,
  printReportToPdf,
  type ReportDoc,
} from "@/lib/report-export";

export type ReportType =
  | "trial-balance"
  | "general-ledger"
  | "balance-sheet"
  | "income-statement"
  | "cash-flow";

export interface ReportExportAudit {
  reportType: ReportType;
  companyId?: string;
  fromDate?: string;
  toDate?: string;
  asOfDate?: string;
  accountId?: string;
}

export function ReportExportButtons({
  disabled,
  filename,
  buildDoc,
  audit,
}: {
  disabled?: boolean;
  filename: string;
  buildDoc: () => ReportDoc;
  audit: ReportExportAudit;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const recordExport = useRecordReportExport();

  const canExport =
    !!user &&
    (user.permissions.includes("*") ||
      user.permissions.includes("accountingReports.export"));
  if (!canExport) return null;

  const handle = (format: "excel" | "pdf") => {
    const doc = buildDoc();
    if (format === "excel") exportReportToExcel(doc, filename);
    else printReportToPdf(doc);
    recordExport.mutate({ data: { ...audit, format } });
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => handle("excel")}
      >
        <FileSpreadsheet className="h-4 w-4 mr-1" />
        {t("export.excel")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => handle("pdf")}
      >
        <Printer className="h-4 w-4 mr-1" />
        {t("export.pdf")}
      </Button>
    </div>
  );
}
