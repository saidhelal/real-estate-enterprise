import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCompanies,
  useListFormTemplates,
  useCreateAdministrativeTask,
  useCreatePrintJob,
  getListFormTemplatesQueryKey,
  renderFormTemplate,
  getListAdministrativeTasksQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-provider";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import { useScreenContext } from "@/lib/screen-context";
import { useDirectory, useUnreadCount } from "@/lib/correspondence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Megaphone, Printer, Eye } from "lucide-react";

/**
 * The three global header actions: correspondence, issue a directive, print.
 *
 * They live in the header rather than on each screen because they are the same
 * action everywhere — a directive issued from a contract screen and one issued
 * from a customer screen are the same record in the same table, differing only
 * by what they point at. Putting them per module is how a system ends up with
 * "sales print" and "legal print" as separate things.
 *
 * Nothing here implements a directive system, a print engine or a mail system.
 * Each button drives the module that already owns the job:
 *   correspondence → the existing /internal-correspondence screen and API
 *   directive      → administrative_tasks, via the generated client
 *   print          → form templates + print jobs, via the same calls the
 *                    Forms & Printing screen uses
 */

/** Permission names follow the existing per-resource convention. */
const PERM_CORRESPONDENCE = "correspondence.view";
const PERM_DIRECTIVE = "administrativeTasks.create";
const PERM_PRINT = "printJobs.create";

function useCan(): (permission: string) => boolean {
  const { user } = useAuth();
  const perms = user?.permissions ?? [];
  const wildcard = perms.includes("*");
  return (permission: string) => wildcard || perms.includes(permission);
}

export function HeaderActions() {
  const can = useCan();
  return (
    <>
      {can(PERM_CORRESPONDENCE) && <CorrespondenceButton />}
      {can(PERM_DIRECTIVE) && <DirectiveButton />}
      {can(PERM_PRINT) && <PrintButton />}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Correspondence                                                             */
/* -------------------------------------------------------------------------- */

function CorrespondenceButton() {
  const { t } = useLanguage();
  // Fails quietly for a login with no employee record — the count is a
  // convenience, and a 409 there must not put an error in the header.
  const { data } = useUnreadCount();
  const unread = data?.unread ?? 0;

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative"
      title={t("corr.title")}
    >
      <Link href="/internal-correspondence">
        <Mail className="h-5 w-5" />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -end-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
        <span className="sr-only">
          {t("corr.title")}
          {unread > 0 ? ` (${unread})` : ""}
        </span>
      </Link>
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Directive                                                                  */
/* -------------------------------------------------------------------------- */

function DirectiveButton() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const screen = useScreenContext();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const directory = useDirectory(companyId);
  const create = useCreateAdministrativeTask();

  const [open, setOpen] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");

  // The screen the user is on becomes the directive's subject line, so a
  // directive issued from a record carries that record without the writer
  // having to describe it. With no context it is simply a general directive.
  const contextNote = screen.label
    ? `${t("directive.context")}: ${screen.label}${screen.entityId ? ` (${screen.entityId})` : ""}`
    : "";

  const reset = () => {
    setAssignee("");
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
  };

  const submit = () => {
    if (!companyId || !title.trim() || !assignee) return;
    create.mutate(
      {
        data: {
          companyId,
          // The register numbers its own rows elsewhere; a directive raised
          // from the header still needs a code, so it carries a timestamped one.
          title: title.trim(),
          description: [description.trim(), contextNote].filter(Boolean).join("\n\n") || undefined,
          assignedToEmployeeId: assignee,
          assignedByUserId: user?.id,
          priority,
          dueDate: dueDate || undefined,
        },
      },
      {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: getListAdministrativeTasksQueryKey() });
          toast({ title: t("directive.issued") });
          reset();
          setOpen(false);
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  const recipients = directory.data?.recipients ?? [];
  const canSubmit = !!companyId && title.trim() !== "" && assignee !== "";

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title={t("directive.issue")}
      >
        <Megaphone className="h-5 w-5" />
        <span className="sr-only">{t("directive.issue")}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("directive.issue")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {screen.label && (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-2xs text-muted-foreground">
                {contextNote}
              </p>
            )}

            <div className="space-y-1.5">
              <Label>{t("directive.assignee")}</Label>
              {recipients.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("corr.no_recipients")}</p>
              ) : (
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("corr.pick_recipient")} />
                  </SelectTrigger>
                  <SelectContent>
                    {recipients.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name} — {e.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("directive.subject")}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("corr.priority")}</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high", "urgent"].map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("directive.due")}</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("directive.body")}</Label>
              <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" disabled={!canSubmit || create.isPending} onClick={submit}>
                {t("directive.send")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Print                                                                      */
/* -------------------------------------------------------------------------- */

/** Open printable HTML in its own window and hand it to the printer. */
function printHtml(html: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}

function PrintButton() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const screen = useScreenContext();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const createPrint = useCreatePrintJob();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Templates are filtered by what the screen declared. With no context the
  // menu is empty rather than offering every template in the company — a print
  // button that lists a hundred unrelated documents is worse than a disabled one.
  const hasContext = !!screen.moduleKey || !!screen.documentType;
  const templateParams = {
    companyId,
    moduleKey: screen.moduleKey,
    documentType: screen.documentType,
    status: "active",
    pageSize: 20,
  };
  const templates = useListFormTemplates(templateParams, {
    query: {
      enabled: !!companyId && hasContext,
      queryKey: getListFormTemplatesQueryKey(templateParams),
    },
  });

  const rows = templates.data?.data ?? [];
  const lang = language === "ar" ? "ar" : "en";

  const doPreview = async (templateId: string) => {
    setBusy(true);
    try {
      const res = await renderFormTemplate({
        templateId,
        entityId: screen.entityId || undefined,
        language: lang,
      });
      setPreview(res.html);
    } catch {
      toast({ title: t("print.failed"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const doPrint = (templateId: string, documentType?: string) => {
    setBusy(true);
    createPrint.mutate(
      {
        data: {
          templateId,
          entityType: documentType ?? screen.documentType,
          entityId: screen.entityId || undefined,
          documentNumber: screen.documentNumber || undefined,
          language: lang,
        },
      },
      {
        onSuccess: (result) => {
          setBusy(false);
          printHtml(result.html);
          toast({ title: t("print.done") });
        },
        onError: () => {
          setBusy(false);
          toast({ title: t("print.failed"), variant: "destructive" });
        },
      },
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={!hasContext || busy}
            title={t("print.title")}
          >
            <Printer className="h-5 w-5" />
            <span className="sr-only">{t("print.title")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="truncate">
            {screen.label ?? t("print.title")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {templates.isLoading ? (
            <DropdownMenuItem disabled>{t("common.loading")}</DropdownMenuItem>
          ) : rows.length === 0 ? (
            <DropdownMenuItem disabled>{t("print.no_templates")}</DropdownMenuItem>
          ) : (
            rows.map((tpl) => (
              <div key={tpl.id} className="px-1 py-0.5">
                <p className="truncate px-2 py-1 text-2xs font-medium text-muted-foreground">
                  {language === "ar" ? tpl.nameAr || tpl.name : tpl.name}
                </p>
                <DropdownMenuItem onSelect={() => void doPreview(tpl.id)}>
                  <Eye className="me-2 h-4 w-4" />
                  {t("print.preview")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => doPrint(tpl.id, tpl.documentType)}>
                  <Printer className="me-2 h-4 w-4" />
                  {t("print.print")}
                </DropdownMenuItem>
              </div>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>{t("print.preview")}</DialogTitle>
          </DialogHeader>
          {/* Sandboxed: a rendered template is server-authored HTML, but it is
              still document content and does not need script or same-origin. */}
          <iframe
            title={t("print.preview")}
            sandbox=""
            srcDoc={preview ?? ""}
            className="h-[70vh] w-full border-0 bg-white"
          />
          <div className="flex justify-end gap-2 px-4 pb-4">
            <Button variant="outline" size="sm" onClick={() => setPreview(null)}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" onClick={() => preview && printHtml(preview)}>
              {t("print.print")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
