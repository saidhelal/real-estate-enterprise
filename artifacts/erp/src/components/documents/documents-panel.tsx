import { useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListModuleDocuments,
  getListModuleDocumentsQueryKey,
  useCreateDocument,
  useListCompanies,
  type Document,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";
import { useToast } from "@/hooks/use-toast";
import { useDocumentUpload, formatFileSize } from "@/lib/document-files";
import { cn } from "@/lib/utils";
import { Upload, FileText } from "lucide-react";

interface DocumentsPanelProps {
  moduleKey: string;
  sourceId: string;
  sourceRef?: string;
  classification?: string;
  documentType?: string;
}

/**
 * Reusable Documents panel embedded in module detail screens. Lists documents
 * linked to a given record (via the document's moduleKey/sourceId) and lets the
 * user attach a new file in place, which creates a document and its first
 * version and links it to the record.
 */
export function DocumentsPanel({
  moduleKey,
  sourceId,
  sourceRef,
  classification = "internal",
  documentType = "other",
}: DocumentsPanelProps) {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const params = { moduleKey, sourceId, companyId };
  const { data, isLoading } = useListModuleDocuments(params, {
    query: { enabled: !!companyId && !!moduleKey && !!sourceId, queryKey: getListModuleDocumentsQueryKey(params) },
  });

  const createMutation = useCreateDocument();
  const { upload, isUploading } = useDocumentUpload();
  const busy = createMutation.isPending || isUploading;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListModuleDocumentsQueryKey(params) });

  const handleFile = async (file: File) => {
    if (!companyId) return;
    try {
      const doc = await createMutation.mutateAsync({
        data: {
          companyId,
          name: file.name,
          documentType,
          classification,
          moduleKey,
          sourceId,
          sourceRef: sourceRef || undefined,
        },
      });
      await upload(doc.id, file);
      toast({ title: t("common.saved") });
      invalidate();
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const rows: Document[] = data?.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("edms.documents_panel")}</CardTitle>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="me-1 h-4 w-4" />
          {busy ? t("edms.uploading") : t("edms.upload")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-center text-sm text-muted-foreground transition-colors",
            dragOver && "border-primary bg-primary/5",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
        >
          <Upload className="mb-2 h-6 w-6" />
          {t("edms.drag_drop")}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("edms.no_documents")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {rows.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <Link href={`/documents/${d.id}`} className="block truncate text-primary hover:underline">
                      {language === "ar" ? (d.nameAr ?? d.name) : d.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {d.documentNumber}
                      {d.currentFileSize != null ? ` · ${formatFileSize(d.currentFileSize)}` : ""}
                    </span>
                  </div>
                </div>
                <Badge variant="secondary">{enumLabel(d.status, language)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
