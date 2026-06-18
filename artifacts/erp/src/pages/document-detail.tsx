import { useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import {
  useGetDocument,
  getGetDocumentQueryKey,
  getListDocumentVersionsQueryKey,
  getListDocumentLinksQueryKey,
  useSubmitDocument,
  useEndorseDocument,
  useApproveDocument,
  useRejectDocument,
  useActivateDocument,
  useArchiveDocument,
  useRestoreDocument,
  useRevertDocumentVersion,
  useSetDocumentSignature,
  useCreateDocumentLink,
  useDeleteDocumentLink,
  type DocumentVersion,
  type DocumentLink,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Upload, Download, Trash2 } from "lucide-react";

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value === undefined || value === null || value === "" ? "-" : value}</p>
    </div>
  );
}

export default function DocumentDetailPage() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, params] = useRoute("/documents/:id");
  const id = params?.id ?? "";

  const { data, isLoading } = useGetDocument(id, {
    query: { enabled: !!id, queryKey: getGetDocumentQueryKey(id) },
  });
  const doc = data?.document;
  const versions: DocumentVersion[] = data?.versions ?? [];
  const links: DocumentLink[] = data?.links ?? [];

  const { upload, isUploading } = useDocumentUpload();
  const submit = useSubmitDocument();
  const endorse = useEndorseDocument();
  const approve = useApproveDocument();
  const reject = useRejectDocument();
  const activate = useActivateDocument();
  const archive = useArchiveDocument();
  const restore = useRestoreDocument();
  const revert = useRevertDocumentVersion();
  const setSignature = useSetDocumentSignature();
  const createLink = useCreateDocumentLink();
  const deleteLink = useDeleteDocumentLink();

  const qrRef = useRef<HTMLImageElement>(null);
  const barcodeRef = useRef<HTMLCanvasElement>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [changeSummary, setChangeSummary] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [signerName, setSignerName] = useState("");
  const [stampLabel, setStampLabel] = useState("");
  const [linkModule, setLinkModule] = useState("");
  const [linkSource, setLinkSource] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetDocumentQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListDocumentVersionsQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListDocumentLinksQueryKey(id) });
  };

  const ok = () => {
    toast({ title: t("common.saved") });
    invalidate();
  };
  const fail = () => toast({ title: t("common.error"), variant: "destructive" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runAction = (mutation: any) =>
    mutation.mutate({ id, data: {} }, { onSuccess: ok, onError: fail });

  const qrValue = doc?.qrValue || doc?.documentNumber || "";
  const barcodeValue = doc?.barcodeValue || doc?.documentNumber || "";

  useEffect(() => {
    if (!qrValue || !qrRef.current) return;
    QRCode.toDataURL(qrValue, { width: 160, margin: 1 })
      .then((url) => {
        if (qrRef.current) qrRef.current.src = url;
      })
      .catch(() => undefined);
  }, [qrValue]);

  useEffect(() => {
    if (!barcodeValue || !barcodeRef.current) return;
    try {
      JsBarcode(barcodeRef.current, barcodeValue, {
        format: "CODE128",
        width: 2,
        height: 60,
        displayValue: true,
      });
    } catch {
      /* ignore invalid barcode input */
    }
  }, [barcodeValue]);

  useEffect(() => {
    if (doc) {
      setSignerName(doc.signerName ?? "");
      setStampLabel(doc.stampLabel ?? "");
    }
  }, [doc]);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">…</div>;
  }
  if (!doc) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-muted-foreground">{t("edms.not_found")}</p>
        <Button asChild variant="outline">
          <Link href="/documents">{t("nav.documents")}</Link>
        </Button>
      </div>
    );
  }

  const handleVersionFile = async (file: File) => {
    try {
      await upload(id, file, changeSummary || undefined);
      setChangeSummary("");
      ok();
    } catch {
      fail();
    }
  };

  const submitReject = () =>
    reject.mutate(
      { id, data: { reason: reason || undefined } },
      {
        onSuccess: () => {
          setRejectOpen(false);
          setReason("");
          ok();
        },
        onError: fail,
      },
    );

  const saveSignature = () =>
    setSignature.mutate(
      { id, data: { signerName: signerName || undefined, stampLabel: stampLabel || undefined } },
      { onSuccess: ok, onError: fail },
    );

  const addLink = () => {
    if (!linkModule.trim() || !linkSource.trim()) return;
    createLink.mutate(
      { id, data: { moduleKey: linkModule.trim(), sourceId: linkSource.trim() } },
      {
        onSuccess: () => {
          setLinkModule("");
          setLinkSource("");
          ok();
        },
        onError: fail,
      },
    );
  };

  const removeLink = (linkId: string) =>
    deleteLink.mutate({ id, linkId }, { onSuccess: ok, onError: fail });

  const kind = previewKind(doc.currentMimeType, doc.currentFileName);
  const fileUrl = documentFileUrl(id);
  const name = language === "ar" ? (doc.nameAr ?? doc.name) : doc.name;

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/documents">{t("nav.documents")}</Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold">{name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{doc.documentNumber}</span>
            <Badge variant="secondary">{enumLabel(doc.status, language)}</Badge>
            <Badge variant="outline">{enumLabel(doc.classification, language)}</Badge>
            <Badge variant="outline">{enumLabel(doc.documentType, language)}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {doc.status === "draft" && (
            <Button size="sm" disabled={submit.isPending} onClick={() => runAction(submit)}>
              {t("edms.submit")}
            </Button>
          )}
          {doc.status === "review" && (
            <>
              <Button size="sm" variant="outline" disabled={endorse.isPending} onClick={() => runAction(endorse)}>
                {t("edms.endorse")}
              </Button>
              <Button size="sm" disabled={approve.isPending} onClick={() => runAction(approve)}>
                {t("edms.approve")}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)}>
                {t("edms.reject")}
              </Button>
            </>
          )}
          {doc.status === "approved" && (
            <Button size="sm" disabled={activate.isPending} onClick={() => runAction(activate)}>
              {t("edms.activate")}
            </Button>
          )}
          {doc.status === "archived" ? (
            <Button size="sm" variant="outline" disabled={restore.isPending} onClick={() => runAction(restore)}>
              {t("edms.restore")}
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={archive.isPending} onClick={() => runAction(archive)}>
              {t("edms.archive")}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">{t("edms.tab.overview")}</TabsTrigger>
          <TabsTrigger value="preview">{t("edms.tab.preview")}</TabsTrigger>
          <TabsTrigger value="versions">{t("edms.tab.versions")}</TabsTrigger>
          <TabsTrigger value="links">{t("edms.tab.links")}</TabsTrigger>
          <TabsTrigger value="codes">{t("edms.tab.codes")}</TabsTrigger>
          <TabsTrigger value="signature">{t("edms.tab.signature")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 pt-6 md:grid-cols-3">
              <Field label={t("edms.name")} value={doc.name} />
              <Field label={t("edms.name_ar")} value={doc.nameAr} />
              <Field label={t("edms.type")} value={enumLabel(doc.documentType, language)} />
              <Field label={t("edms.classification")} value={enumLabel(doc.classification, language)} />
              <Field label={t("edms.module")} value={doc.moduleKey ? enumLabel(doc.moduleKey, language) : "-"} />
              <Field label={t("edms.document_date")} value={doc.creationDate} />
              <Field label={t("edms.expiry_date")} value={doc.expiryDate} />
              <Field label={t("edms.current_version")} value={doc.currentVersionNumber} />
              <Field label={t("edms.file_size")} value={formatFileSize(doc.currentFileSize)} />
              <Field label={t("edms.created_by")} value={doc.createdByUserName} />
              <Field label={t("edms.approved_by")} value={doc.approvedByUserName} />
              <Field label={t("edms.description")} value={doc.description} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("edms.tab.preview")}</CardTitle>
              {doc.currentVersionId && (
                <Button asChild size="sm" variant="outline">
                  <a href={fileUrl} target="_blank" rel="noreferrer">
                    <Download className="me-1 h-4 w-4" />
                    {t("edms.download")}
                  </a>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!doc.currentVersionId ? (
                <p className="text-sm text-muted-foreground">{t("edms.no_file")}</p>
              ) : kind === "image" ? (
                <img src={fileUrl} alt={name} className="max-h-[600px] rounded-md border" />
              ) : kind === "pdf" ? (
                <iframe src={fileUrl} title={name} className="h-[600px] w-full rounded-md border" />
              ) : kind === "text" ? (
                <iframe
                  src={fileUrl}
                  title={name}
                  sandbox=""
                  className="h-[400px] w-full rounded-md border"
                />
              ) : (
                <p className="text-sm text-muted-foreground">{t("edms.no_preview")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("edms.new_version")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-1.5">
                <Label>{t("edms.change_summary")}</Label>
                <Input value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} />
              </div>
              <input
                ref={versionInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleVersionFile(f);
                  e.target.value = "";
                }}
              />
              <div
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-center text-sm text-muted-foreground transition-colors",
                  dragOver && "border-primary bg-primary/5",
                )}
                onClick={() => versionInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void handleVersionFile(f);
                }}
              >
                <Upload className="mb-2 h-6 w-6" />
                {isUploading ? t("edms.uploading") : t("edms.drag_drop")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("edms.version")}</TableHead>
                    <TableHead>{t("edms.file_name")}</TableHead>
                    <TableHead>{t("edms.file_size")}</TableHead>
                    <TableHead>{t("edms.change_summary")}</TableHead>
                    <TableHead>{t("edms.uploaded_by")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        {t("edms.no_versions")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    versions.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            v{v.versionNumber}
                            {v.isCurrent && <Badge variant="secondary">{t("edms.current")}</Badge>}
                          </span>
                        </TableCell>
                        <TableCell>{v.fileName ?? "-"}</TableCell>
                        <TableCell>{formatFileSize(v.fileSize)}</TableCell>
                        <TableCell>{v.changeSummary ?? "-"}</TableCell>
                        <TableCell>{v.uploadedByUserName ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button asChild size="sm" variant="outline">
                              <a href={documentFileUrl(id, v.id)} target="_blank" rel="noreferrer">
                                {t("common.view")}
                              </a>
                            </Button>
                            {!v.isCurrent && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={revert.isPending}
                                onClick={() =>
                                  revert.mutate(
                                    { id, versionId: v.id },
                                    { onSuccess: ok, onError: fail },
                                  )
                                }
                              >
                                {t("edms.revert")}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("edms.add_link")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label>{t("edms.module")}</Label>
                <Input value={linkModule} onChange={(e) => setLinkModule(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("edms.source_id")}</Label>
                <Input value={linkSource} onChange={(e) => setLinkSource(e.target.value)} />
              </div>
              <Button disabled={createLink.isPending || !linkModule.trim() || !linkSource.trim()} onClick={addLink}>
                {t("common.add")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("edms.module")}</TableHead>
                    <TableHead>{t("edms.source_id")}</TableHead>
                    <TableHead>{t("edms.linked_by")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        {t("edms.no_links")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    links.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <Badge variant="secondary">{enumLabel(l.moduleKey, language)}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{l.sourceRef ?? l.sourceId}</TableCell>
                        <TableCell>{l.linkedByUserName ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={deleteLink.isPending}
                            onClick={() => removeLink(l.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="codes" className="mt-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-10 pt-6">
              <div className="space-y-2 text-center">
                <p className="text-sm font-medium">{t("edms.qr_code")}</p>
                <img ref={qrRef} alt="QR" className="h-40 w-40 rounded-md border bg-white p-2" />
              </div>
              <div className="space-y-2 text-center">
                <p className="text-sm font-medium">{t("edms.barcode")}</p>
                <canvas ref={barcodeRef} className="rounded-md border bg-white p-2" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signature" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("edms.tab.signature")}</CardTitle>
            </CardHeader>
            <CardContent className="max-w-md space-y-3">
              <div className="grid gap-1.5">
                <Label>{t("edms.signer_name")}</Label>
                <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("edms.stamp_label")}</Label>
                <Input value={stampLabel} onChange={(e) => setStampLabel(e.target.value)} />
              </div>
              {doc.signedAt && (
                <p className="text-xs text-muted-foreground">
                  {t("edms.signed_at")}: {doc.signedAt}
                </p>
              )}
              <Button disabled={setSignature.isPending} onClick={saveSignature}>
                {t("common.save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("edms.reject")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("edms.reject_reason")}</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" disabled={reject.isPending} onClick={submitReject}>
              {t("edms.reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
