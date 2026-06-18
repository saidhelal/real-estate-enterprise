import { useState } from "react";
import { useLanguage } from "@/lib/language-provider";
import {
  useListChangeRequests,
  useApproveChangeRequest,
  useRejectChangeRequest,
  getListChangeRequestsQueryKey,
  ChangeRequest,
  ListChangeRequestsStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle, Eye } from "lucide-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  executed: "default",
  rejected: "destructive",
  failed: "destructive",
};

export default function ApprovalsPage() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<ListChangeRequestsStatus>(
    ListChangeRequestsStatus.pending,
  );
  const [reviewNotes, setReviewNotes] = useState("");
  const [viewing, setViewing] = useState<ChangeRequest | null>(null);
  const [acting, setActing] = useState<{ req: ChangeRequest; mode: "approve" | "reject" } | null>(
    null,
  );

  const { data, isLoading } = useListChangeRequests(
    { status: statusFilter },
    { query: { queryKey: getListChangeRequestsQueryKey({ status: statusFilter }) } },
  );
  const rows = data?.data ?? [];

  const approveMutation = useApproveChangeRequest();
  const rejectMutation = useRejectChangeRequest();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getListChangeRequestsQueryKey({ status: statusFilter }),
    });

  const submitAction = () => {
    if (!acting) return;
    const notes = reviewNotes.trim();
    const opts = {
      onSuccess: () => {
        toast({
          title:
            acting.mode === "approve" ? t("approvals.approved") : t("approvals.rejected"),
        });
        setActing(null);
        setReviewNotes("");
        invalidate();
      },
      onError: (err: unknown) =>
        toast({
          title: t("common.error"),
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive" as const,
        }),
    };
    if (acting.mode === "approve") {
      approveMutation.mutate(
        { id: acting.req.id, data: { reviewNotes: notes || undefined } },
        opts,
      );
    } else {
      rejectMutation.mutate(
        { id: acting.req.id, data: { reviewNotes: notes || undefined } },
        opts,
      );
    }
  };

  const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("approvals.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("approvals.subtitle")}</p>
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as ListChangeRequestsStatus)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">{t("approvals.status.pending")}</SelectItem>
            <SelectItem value="approved">{t("approvals.status.approved")}</SelectItem>
            <SelectItem value="executed">{t("approvals.status.executed")}</SelectItem>
            <SelectItem value="rejected">{t("approvals.status.rejected")}</SelectItem>
            <SelectItem value="failed">{t("approvals.status.failed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("approvals.col.type")}</TableHead>
              <TableHead>{t("approvals.col.entity")}</TableHead>
              <TableHead>{t("approvals.col.reason")}</TableHead>
              <TableHead>{t("approvals.col.requested_by")}</TableHead>
              <TableHead>{t("approvals.col.requested_at")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  {t("common.no_results")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>
                    <Badge variant={req.requestType === "delete" ? "destructive" : "secondary"}>
                      {t(`approvals.type.${req.requestType}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {req.entityLabel || req.entity}
                    <span className="block text-xs text-muted-foreground">{req.entity}</span>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
                  <TableCell>{req.requestedByName}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDate(req.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[req.status] ?? "secondary"}>
                      {t(`approvals.status.${req.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    <Button variant="ghost" size="icon" onClick={() => setViewing(req)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {req.status === "pending" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-green-600"
                          onClick={() => {
                            setReviewNotes("");
                            setActing({ req, mode: "approve" });
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => {
                            setReviewNotes("");
                            setActing({ req, mode: "reject" });
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("approvals.details")}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-2 text-sm">
              <Row label={t("approvals.col.type")} value={t(`approvals.type.${viewing.requestType}`)} />
              <Row label={t("approvals.col.entity")} value={viewing.entityLabel || viewing.entity} />
              <Row label={t("approvals.field.method")} value={`${viewing.method} ${viewing.path}`} />
              <Row label={t("approvals.col.reason")} value={viewing.reason} />
              <Row label={t("approvals.col.requested_by")} value={viewing.requestedByName} />
              <Row label={t("approvals.col.requested_at")} value={fmtDate(viewing.createdAt)} />
              <Row label={t("common.status")} value={t(`approvals.status.${viewing.status}`)} />
              {viewing.reviewedByName && (
                <Row label={t("approvals.field.reviewed_by")} value={viewing.reviewedByName} />
              )}
              {viewing.reviewNotes && (
                <Row label={t("approvals.field.review_notes")} value={viewing.reviewNotes} />
              )}
              {viewing.executionError && (
                <Row label={t("approvals.field.execution_error")} value={viewing.executionError} />
              )}
              {viewing.payload != null && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t("approvals.field.payload")}
                  </p>
                  <pre
                    dir="ltr"
                    className="rounded bg-muted p-2 text-xs overflow-auto max-h-48 text-left"
                  >
                    {JSON.stringify(viewing.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!acting}
        onOpenChange={(open) => {
          if (!open) {
            setActing(null);
            setReviewNotes("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {acting?.mode === "approve" ? t("approvals.approve") : t("approvals.reject")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {acting?.mode === "approve"
                ? t("approvals.approve_hint")
                : t("approvals.reject_hint")}
            </p>
            <div className="space-y-2">
              <Label>{t("approvals.field.review_notes")}</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                dir={language === "ar" ? "rtl" : undefined}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setActing(null);
                  setReviewNotes("");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant={acting?.mode === "approve" ? "default" : "destructive"}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                onClick={submitAction}
              >
                {acting?.mode === "approve" ? t("approvals.approve") : t("approvals.reject")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="font-medium text-muted-foreground min-w-32">{label}:</span>
      <span className="break-all">{value}</span>
    </div>
  );
}
