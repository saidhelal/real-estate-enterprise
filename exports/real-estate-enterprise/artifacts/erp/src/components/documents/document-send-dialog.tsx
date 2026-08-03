import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSendDocument,
  useListUsers,
  getListUsersQueryKey,
  useListDepartments,
  getListDepartmentsQueryKey,
  getListDocumentInboxQueryKey,
  getListSentDocumentsQueryKey,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/lib/language-provider";
import { enumOptions } from "@/lib/enums";
import { useToast } from "@/hooks/use-toast";

const PRIORITIES = ["normal", "medium", "high", "urgent"];

interface DocumentSendDialogProps {
  documentId: string;
  documentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Routes an existing central document to recipients (users and/or departments).
 * The file is referenced by id — never copied. On success the server tracks
 * per-recipient delivery status and notifies each recipient with a direct link.
 */
export function DocumentSendDialog({
  documentId,
  documentName,
  open,
  onOpenChange,
}: DocumentSendDialogProps) {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [userSearch, setUserSearch] = useState("");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState("normal");

  const usersParams = { search: userSearch || undefined };
  const { data: users } = useListUsers(usersParams, {
    query: { enabled: open, queryKey: getListUsersQueryKey(usersParams) },
  });
  const { data: departments } = useListDepartments(undefined, {
    query: { enabled: open, queryKey: getListDepartmentsQueryKey() },
  });
  const sendMutation = useSendDocument();

  const priorityOptions = useMemo(() => enumOptions(PRIORITIES), []);
  const userList = users ?? [];
  const deptList = departments?.data ?? [];

  const reset = () => {
    setUserSearch("");
    setUserIds([]);
    setDeptIds([]);
    setSubject("");
    setNote("");
    setPriority("normal");
  };

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const total = userIds.length + deptIds.length;

  const submit = () => {
    if (total === 0) return;
    sendMutation.mutate(
      {
        data: {
          documentId,
          recipientUserIds: userIds.length ? userIds : undefined,
          recipientDepartmentIds: deptIds.length ? deptIds : undefined,
          subject: subject.trim() || undefined,
          note: note.trim() || undefined,
          priority,
        },
      },
      {
        onSuccess: () => {
          toast({ title: t("transfers.sent_toast") });
          queryClient.invalidateQueries({ queryKey: getListSentDocumentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListDocumentInboxQueryKey() });
          reset();
          onOpenChange(false);
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent
        className="max-h-[88vh] overflow-y-auto sm:max-w-2xl"
        dir={language === "ar" ? "rtl" : "ltr"}
      >
        <DialogHeader>
          <DialogTitle>{t("transfers.send_title")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">{t("transfers.document")}: </span>
            <span className="font-medium">{documentName}</span>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("transfers.subject")}</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label>{t("transfers.note")}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          <div className="grid gap-1.5 sm:w-1/2">
            <Label>{t("transfers.priority")}</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {language === "ar" ? o.labelAr : o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t("transfers.recipients_users")}</Label>
              <Input
                placeholder={t("common.search")}
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
              <ScrollArea className="h-48 rounded-md border p-2">
                {userList.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">{t("transfers.no_users")}</p>
                ) : (
                  <ul className="space-y-1">
                    {userList.map((u) => (
                      <li key={u.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded p-1.5 text-sm hover:bg-accent">
                          <Checkbox
                            checked={userIds.includes(u.id)}
                            onCheckedChange={() => toggle(userIds, setUserIds, u.id)}
                          />
                          <span className="min-w-0 truncate">
                            {u.fullName}
                            <span className="text-muted-foreground"> · {u.username}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </div>

            <div className="grid gap-1.5">
              <Label>{t("transfers.recipients_departments")}</Label>
              <ScrollArea className="mt-[34px] h-48 rounded-md border p-2">
                {deptList.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">
                    {t("transfers.no_departments")}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {deptList.map((d) => (
                      <li key={d.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded p-1.5 text-sm hover:bg-accent">
                          <Checkbox
                            checked={deptIds.includes(d.id)}
                            onCheckedChange={() => toggle(deptIds, setDeptIds, d.id)}
                          />
                          <span className="min-w-0 truncate">
                            {language === "ar" ? (d.nameAr ?? d.name) : d.name}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </div>
          </div>

          {total > 0 && (
            <Badge variant="secondary" className="w-fit">
              {t("transfers.selected_count")}: {total}
            </Badge>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={total === 0 || sendMutation.isPending} onClick={submit}>
            {t("transfers.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
