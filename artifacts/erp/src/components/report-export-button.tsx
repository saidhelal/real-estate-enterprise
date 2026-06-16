import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useRecordReportExport } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-provider";
import { useLanguage } from "@/lib/language-provider";
import {
  exportReportToExcel,
  exportReportToPdf,
  type ReportExport,
} from "@/lib/report-export";

export type ReportType =
  | "trial-balance"
  | "general-ledger"
  | "balance-sheet"
  | "income-statement"
  | "cash-flow"
  | "ar-aging"
  | "ap-aging"
  | "tax";

export interface ReportExportAudit {
  reportType: ReportType;
  companyId?: string;
  fromDate?: string;
  toDate?: string;
  asOfDate?: string;
  accountId?: string;
}

interface ReportExportButtonProps {
  build: () => ReportExport | null;
  baseFilename: string;
  disabled?: boolean;
  audit: ReportExportAudit;
}

export function ReportExportButton({
  build,
  baseFilename,
  disabled,
  audit,
}: ReportExportButtonProps) {
  const { t, dir } = useLanguage();
  const { user } = useAuth();
  const recordExport = useRecordReportExport();

  const canExport =
    !!user &&
    (user.permissions.includes("*") ||
      user.permissions.includes("accountingReports.export"));
  if (!canExport) return null;

  const handleExcel = () => {
    const report = build();
    if (!report) return;
    exportReportToExcel(report, baseFilename, t("acc.generated"));
    recordExport.mutate({ data: { ...audit, format: "excel" } });
  };
  const handlePdf = () => {
    const report = build();
    if (!report) return;
    exportReportToPdf(report, t("acc.generated"));
    recordExport.mutate({ data: { ...audit, format: "pdf" } });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Download className="mr-2 h-4 w-4" />
          {t("acc.export")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={dir === "rtl" ? "start" : "end"}>
        <DropdownMenuItem onClick={handleExcel}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {t("acc.export_excel")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdf}>
          <FileText className="mr-2 h-4 w-4" />
          {t("acc.export_pdf")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
