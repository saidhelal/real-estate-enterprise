import { useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListModuleDocuments,
  getListModuleDocumentsQueryKey,
  useCreateDocument,
  useDeleteDocument,
  useListCompanies,
  setNextChangeReason,
  type Document,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";
import { useToast } from "@/hooks/use-toast";
import {
  useDocumentUpload,
  formatFileSize,
  documentFileUrl,
  previewKind,
} from "@/lib/document-files";
import { cn } from "@/lib/utils";
import { Upload, FileText, Download, Trash2, Eye, Send } from "lucide-react";
import { DocumentSendDialog } from "./document-send-dialog";

interface DocumentsPanelProps {
  moduleKey: string;
  sourceId: string;
  sourceRef?: string;
  classification?: string;
  documentType?: string;
}

/** Server governance middleware answers a governed mutation with 202 + this shape. */
function isPendingApproval(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    "pendingApproval" in result &&
    (result as { pendingApproval?: unknown }).pendingApproval === true
  );
}

/**
 * Reusable Attachments panel embedded in module screens (via DocumentsRowAction).
 * Lists documents linked to a given record (document moduleKey/sourceId), and lets
 * the user attach a new file, preview it inline (images / PDF / text), download it,
 * or delete it. All actions go through the central Document Management repository —
 * no separate attachments store. Deletion is routed through the governance
 * middleware (parked as a change request when required).
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
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [sendDoc, setSendDoc] = useState<Document | null>(null);

  const params = { moduleKey, sourceId, companyId };
  const { data, isLoading } = useListModuleDocuments(params, {
    query: { enabled: !!companyId && !!moduleKey && !!sourceId, queryKey: getListModuleDocumentsQueryKey(params) },
  });

  const createMutation = useCreateDocument();
  const deleteMutation = useDeleteDocument();
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

  const confirmDelete = () => {
    if (!deleteDoc) return;
    const reason = deleteReason.trim();
    if (!reason) return;
    setNextChangeReason(reason, deleteDoc.name);
    deleteMutation.mutate(
      { id: deleteDoc.id },
      {
        onSuccess: (result) => {
          toast({
            title: isPendingApproval(result) ? t("governance.submitted") : t("common.deleted"),
          });
          setDeleteDoc(null);
          setDeleteReason("");
          invalidate();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  const rows: Document[] = data?.data ?? [];
  const previewK = previewDoc
    ? previewKind(previewDoc.currentMimeType, previewDoc.currentFileName ?? previewDoc.name)
    : "none";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("edms.attachments")}</CardTitle>
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
            {rows.map((d) => {
              const kind = previewKind(d.currentMimeType, d.currentFileName ?? d.name);
              const hasFile = !!d.currentVersionId;
              return (
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
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant="secondary">{enumLabel(d.status, language)}</Badge>
                    {hasFile && kind !== "none" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t("edms.preview")}
                        onClick={() => setPreviewDoc(d)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {hasFile && (
                      <Button asChild variant="ghost" size="icon" title={t("edms.download")}>
                        <a href={documentFileUrl(d.id, undefined, true)}>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      title={t("transfers.send")}
                      onClick={() => setSendDoc(d)}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      title={t("edms.delete_file")}
                      onClick={() => {
                        setDeleteReason("");
                        setDeleteDoc(d);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl" dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="truncate">
              {previewDoc
                ? language === "ar"
                  ? (previewDoc.nameAr ?? previewDoc.name)
                  : previewDoc.name
                : ""}
            </DialogTitle>
          </DialogHeader>
          {previewDoc && previewK === "image" && (
            <img
              src={documentFileUrl(previewDoc.id)}
              alt=""
              className="max-h-[70vh] w-full object-contain"
            />
          )}
          {previewDoc && (previewK === "pdf" || previewK === "text") && (
            <iframe
              src={documentFileUrl(previewDoc.id)}
              title={previewDoc.name}
              className="h-[70vh] w-full rounded border"
            />
          )}
          {previewDoc && (
            <DialogFooter>
              <Button asChild variant="outline">
                <a href={documentFileUrl(previewDoc.id, undefined, true)}>
                  <Download className="me-1 h-4 w-4" />
                  {t("edms.download")}
                </a>
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDoc} onOpenChange={(o) => !o && setDeleteDoc(null)}>
        <DialogContent dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("edms.delete_file")}</DialogTitle>
            <DialogDescription>{t("governance.delete_hint")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>{t("governance.reason")}</Label>
            <Textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder={t("governance.reason_placeholder")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDoc(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteReason.trim() || deleteMutation.isPending}
              onClick={confirmDelete}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {sendDoc && (
        <DocumentSendDialog
          documentId={sendDoc.id}
          documentName={language === "ar" ? (sendDoc.nameAr ?? sendDoc.name) : sendDoc.name}
          open={!!sendDoc}
          onOpenChange={(o) => !o && setSendDoc(null)}
        />
      )}
    </Card>
  );
}
