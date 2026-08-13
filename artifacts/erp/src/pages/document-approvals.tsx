import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDocuments,
  getListDocumentsQueryKey,
  useEndorseDocument,
  useApproveDocument,
  useRejectDocument,
  useListCompanies,
  type Document,
} from "@workspace/api-client-react";
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
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";
import { useToast } from "@/hooks/use-toast";

export default function DocumentApprovalsPage() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId, status: "review", pageSize: 200 };
  const { data, isLoading } = useListDocuments(params, {
    query: { enabled: !!companyId, queryKey: getListDocumentsQueryKey(params) },
  });

  const endorse = useEndorseDocument();
  const approve = useApproveDocument();
  const reject = useRejectDocument();

  const [rejectTarget, setRejectTarget] = useState<Document | null>(null);
  const [reason, setReason] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runAction = (mutation: any, id: string) => {
    mutation.mutate(
      { id, data: {} },
      {
        onSuccess: () => {
          toast({ title: t("common.saved") });
          invalidate();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  const submitReject = () => {
    if (!rejectTarget) return;
    reject.mutate(
      { id: rejectTarget.id, data: { reason: reason || undefined } },
      {
        onSuccess: () => {
          toast({ title: t("common.saved") });
          setRejectTarget(null);
          setReason("");
          invalidate();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  const rows: Document[] = data?.data ?? [];

  return (
    <div className="space-y-6 p-1">
      <PageHeader
        title={t("edms.approvals.title")}
        description={t("edms.subtitle")}
        bordered={false}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("edms.kpi.pending")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("edms.document_number")}</TableHead>
                <TableHead>{t("edms.name")}</TableHead>
                <TableHead>{t("edms.type")}</TableHead>
                <TableHead>{t("edms.classification")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    …
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {t("edms.approvals.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Link href={`/documents/${d.id}`} className="text-primary hover:underline">
                        {d.documentNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{language === "ar" ? (d.nameAr ?? d.name) : d.name}</TableCell>
                    <TableCell>{enumLabel(d.documentType, language)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{enumLabel(d.classification, language)}</Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={endorse.isPending}
                          onClick={() => runAction(endorse, d.id)}
                        >
                          {t("edms.endorse")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={approve.isPending}
                          onClick={() => runAction(approve, d.id)}
                        >
                          {t("edms.approve")}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setRejectTarget(d);
                            setReason("");
                          }}
                        >
                          {t("edms.reject")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("edms.reject")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("edms.reject_reason")}</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
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
