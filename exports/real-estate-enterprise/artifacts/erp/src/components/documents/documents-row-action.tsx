import { useState } from "react";
import { Paperclip } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-provider";
import { DocumentsPanel } from "./documents-panel";

interface DocumentsRowActionProps {
  moduleKey: string;
  sourceId: string;
  sourceRef?: string;
  documentType?: string;
  classification?: string;
}

/**
 * Row-action that opens a side sheet with the reusable Documents panel for a
 * single record. Pass via the ResourceManager `rowActions` prop.
 */
export function DocumentsRowAction({
  moduleKey,
  sourceId,
  sourceRef,
  documentType,
  classification,
}: DocumentsRowActionProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" title={t("edms.attachments")}>
          <Paperclip className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("edms.attachments")}</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          {open && (
            <DocumentsPanel
              moduleKey={moduleKey}
              sourceId={sourceId}
              sourceRef={sourceRef}
              documentType={documentType}
              classification={classification}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
