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

/** The eight accounting reports. Kept as a name for the pages that use it. */
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
  /** What was exported — a report name, or a register's resource key. */
  reportType: ReportType | string;
  /**
   * The module owning the data, for anything that is not an accounting
   * report. It decides both the permission asked for here and the permission
   * the server checks, so the two cannot drift apart.
   */
  module?: string;
  /** Rows exported, recorded because that is what a reviewer asks first. */
  recordCount?: number;
  companyId?: string;
  fromDate?: string;
  toDate?: string;
  asOfDate?: string;
  accountId?: string;
}

interface ReportExportButtonProps {
  /**
   * The report to export. Report pages already hold their figures and return
   * one directly; a register holds only the page on screen and has to fetch
   * the rest, so this may also return a promise.
   */
  build: () => ReportExport | null | Promise<ReportExport | null>;
  baseFilename: string;
  disabled?: boolean;
  audit: ReportExportAudit;
  /** Renders as a plain icon button where a labelled one would crowd a toolbar. */
  compact?: boolean;
}

export function ReportExportButton({
  build,
  baseFilename,
  disabled,
  audit,
  compact,
}: ReportExportButtonProps) {
  const { t, dir } = useLanguage();
  const { user } = useAuth();
  const recordExport = useRecordReportExport();

  // Reading a register on screen and taking the same rows to a spreadsheet are
  // the same disclosure, so a module export is authorised by that module's own
  // `.view`. Accounting reports keep the dedicated permission they had.
  const required = audit.module ? `${audit.module}.view` : "accountingReports.export";
  const canExport =
    !!user && (user.permissions.includes("*") || user.permissions.includes(required));
  if (!canExport) return null;

  const run = async (format: "excel" | "pdf") => {
    const report = await build();
    if (!report) return;
    if (format === "excel") exportReportToExcel(report, baseFilename, t("acc.generated"));
    else exportReportToPdf(report, t("acc.generated"));
    // The count comes from what was actually exported, not from what the
    // caller expected to export — a register fetches its rows inside `build`.
    const recordCount = audit.recordCount ?? report.sections.reduce((n, s) => n + s.rows.length, 0);
    recordExport.mutate({ data: { ...audit, recordCount, format } });
  };

  const handleExcel = () => void run("excel");
  const handlePdf = () => void run("pdf");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "icon" : "default"}
          disabled={disabled}
          title={compact ? t("acc.export") : undefined}
          aria-label={compact ? t("acc.export") : undefined}
        >
          <Download className={compact ? "h-4 w-4" : "me-2 h-4 w-4"} />
          {compact ? null : t("acc.export")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={dir === "rtl" ? "start" : "end"}>
        <DropdownMenuItem onClick={handleExcel}>
          <FileSpreadsheet className="me-2 h-4 w-4" />
          {t("acc.export_excel")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdf}>
          <FileText className="me-2 h-4 w-4" />
          {t("acc.export_pdf")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
