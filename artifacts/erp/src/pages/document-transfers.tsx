import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDocumentInbox,
  getListDocumentInboxQueryKey,
  useListSentDocuments,
  getListSentDocumentsQueryKey,
  useGetDocumentTransfer,
  getGetDocumentTransferQueryKey,
  useMarkDocumentTransferReceived,
  useMarkDocumentTransferViewed,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";
import { Download } from "lucide-react";
import { documentFileUrl } from "@/lib/document-files";

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "viewed") return "default";
  if (status === "received") return "secondary";
  return "outline";
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

export default function DocumentTransfersPage() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const search = useSearch();
  const initialTransfer = new URLSearchParams(search).get("transfer");

  const [tab, setTab] = useState("inbox");
  const [inboxSearch, setInboxSearch] = useState("");
  const [sentSearch, setSentSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialTransfer);

  const inboxParams = { search: inboxSearch || undefined };
  const { data: inbox, isLoading: inboxLoading } = useListDocumentInbox(inboxParams, {
    query: { queryKey: getListDocumentInboxQueryKey(inboxParams) },
  });
  const sentParams = { search: sentSearch || undefined };
  const { data: sent, isLoading: sentLoading } = useListSentDocuments(sentParams, {
    query: { queryKey: getListSentDocumentsQueryKey(sentParams) },
  });

  const markReceived = useMarkDocumentTransferReceived();
  const markViewed = useMarkDocumentTransferViewed();

  const inboxRows = inbox?.data ?? [];
  const sentRows = sent?.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListDocumentInboxQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListSentDocumentsQueryKey() });
  };

  // Opening an inbox item acknowledges delivery (sent -> received).
  const openTransfer = (id: string, fromInbox: boolean) => {
    setOpenId(id);
    if (fromInbox) {
      markReceived.mutate({ id }, { onSuccess: invalidate });
    }
  };

  // Opening the underlying file marks the transfer viewed.
  const onViewDocument = (id: string) => {
    markViewed.mutate({ id }, { onSuccess: invalidate });
  };

  return (
    <div className="space-y-6 p-1">
      <div>
        <h1 className="text-2xl font-bold">{t("transfers.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("transfers.subtitle")}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="inbox">{t("transfers.inbox")}</TabsTrigger>
          <TabsTrigger value="sent">{t("transfers.sent_tab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <Input
                className="mb-4 max-w-sm"
                placeholder={t("edms.search_placeholder")}
                value={inboxSearch}
                onChange={(e) => setInboxSearch(e.target.value)}
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("transfers.document")}</TableHead>
                    <TableHead>{t("transfers.from")}</TableHead>
                    <TableHead>{t("transfers.subject")}</TableHead>
                    <TableHead>{t("transfers.priority")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("transfers.received_on")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inboxLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        …
                      </TableCell>
                    </TableRow>
                  ) : inboxRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        {t("transfers.empty_inbox")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    inboxRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {language === "ar" ? (r.documentNameAr ?? r.documentName) : r.documentName}
                          <span className="block text-xs text-muted-foreground">
                            {r.documentNumber}
                          </span>
                        </TableCell>
                        <TableCell>{r.senderUserName}</TableCell>
                        <TableCell>{r.subject ?? "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{enumLabel(r.priority, language)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(r.status)}>
                            {enumLabel(r.status, language)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(r.receivedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openTransfer(r.transferId, true)}
                          >
                            {t("common.view")}
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

        <TabsContent value="sent" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <Input
                className="mb-4 max-w-sm"
                placeholder={t("edms.search_placeholder")}
                value={sentSearch}
                onChange={(e) => setSentSearch(e.target.value)}
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("transfers.document")}</TableHead>
                    <TableHead>{t("transfers.recipients")}</TableHead>
                    <TableHead>{t("transfers.subject")}</TableHead>
                    <TableHead>{t("transfers.progress")}</TableHead>
                    <TableHead>{t("transfers.sent_on")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sentLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        …
                      </TableCell>
                    </TableRow>
                  ) : sentRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        {t("transfers.empty_sent")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sentRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {language === "ar" ? (r.documentNameAr ?? r.documentName) : r.documentName}
                          <span className="block text-xs text-muted-foreground">
                            {r.documentNumber}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate">
                          {r.recipientSummary ?? `${r.recipientCount}`}
                        </TableCell>
                        <TableCell>{r.subject ?? "-"}</TableCell>
                        <TableCell className="text-xs">
                          <span className="text-muted-foreground">
                            {t("transfers.viewed_count")}:
                          </span>{" "}
                          {r.viewedCount ?? 0} / {r.recipientCount}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(r.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openTransfer(r.id, false)}
                          >
                            {t("common.view")}
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
      </Tabs>

      <TransferDetailDialog
        transferId={openId}
        onClose={() => setOpenId(null)}
        onViewDocument={onViewDocument}
      />
    </div>
  );
}

function TransferDetailDialog({
  transferId,
  onClose,
  onViewDocument,
}: {
  transferId: string | null;
  onClose: () => void;
  onViewDocument: (id: string) => void;
}) {
  const { language, t } = useLanguage();
  const { data, isLoading } = useGetDocumentTransfer(transferId ?? "", {
    query: {
      enabled: !!transferId,
      queryKey: getGetDocumentTransferQueryKey(transferId ?? ""),
    },
  });

  const transfer = data?.transfer;
  const recipients = data?.recipients ?? [];
  const documentId = transfer?.documentId;

  // Mark viewed once when the recipient opens the detail (best-effort).
  const [viewed, setViewed] = useState(false);
  useEffect(() => {
    setViewed(false);
  }, [transferId]);
  useEffect(() => {
    if (transferId && data?.myStatus && data.myStatus !== "viewed" && !viewed) {
      setViewed(true);
      onViewDocument(transferId);
    }
  }, [transferId, data?.myStatus, viewed, onViewDocument]);

  return (
    <Dialog open={!!transferId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[88vh] overflow-y-auto sm:max-w-2xl"
        dir={language === "ar" ? "rtl" : "ltr"}
      >
        <DialogHeader>
          <DialogTitle>{t("transfers.detail_title")}</DialogTitle>
        </DialogHeader>
        {isLoading || !transfer ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : (
          <div className="grid gap-4">
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">
                {language === "ar"
                  ? (transfer.documentNameAr ?? transfer.documentName)
                  : transfer.documentName}
              </div>
              <div className="text-xs text-muted-foreground">{transfer.documentNumber}</div>
              {transfer.subject && <div className="mt-2">{transfer.subject}</div>}
              {transfer.note && (
                <div className="mt-1 text-muted-foreground">{transfer.note}</div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t("transfers.from")}:</span>
                <span className="text-xs">{transfer.senderUserName}</span>
                <Badge variant="outline">{enumLabel(transfer.priority, language)}</Badge>
              </div>
            </div>

            {documentId && (
              <Button asChild variant="outline" className="w-fit">
                <Link href={`/documents/${documentId}`}>
                  <Download className="me-1 h-4 w-4" />
                  {t("transfers.open_document")}
                </Link>
              </Button>
            )}

            <div>
              <h3 className="mb-2 text-sm font-medium">{t("transfers.recipients")}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("transfers.recipient")}</TableHead>
                    <TableHead>{t("transfers.via_department")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("transfers.viewed_on")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((rc) => (
                    <TableRow key={rc.id}>
                      <TableCell>{rc.recipientUserName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {rc.viaDepartmentName ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(rc.status)}>
                          {enumLabel(rc.status, language)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDate(rc.viewedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
