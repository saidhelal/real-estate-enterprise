import { CircleDot } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSetUnitStatus,
  getListUnitsQueryKey,
} from "@workspace/api-client-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language-provider";

type StatusCode =
  | "available"
  | "delivered"
  | "blocked"
  | "maintenance"
  | "cancelled";

interface ActionDef {
  code: StatusCode;
  en: string;
  ar: string;
}

// The four manual lifecycle overrides plus a "release" action that hands the
// unit back to the auto-derived status (available/reserved/sold).
const OVERRIDE_ACTIONS: ActionDef[] = [
  { code: "delivered", en: "Mark delivered", ar: "تحديد كمُسلّمة" },
  { code: "blocked", en: "Block", ar: "حظر" },
  { code: "maintenance", en: "Send to maintenance", ar: "إرسال للصيانة" },
  { code: "cancelled", en: "Cancel", ar: "إلغاء" },
];

const RELEASE_ACTION: ActionDef = {
  code: "available",
  en: "Release (auto status)",
  ar: "تحرير (حالة تلقائية)",
};

interface UnitStatusRowActionProps {
  unitId: string;
}

/**
 * Row-action menu that sets a unit's lifecycle status to one of the manual
 * overrides (delivered/blocked/maintenance/cancelled) or releases it back to
 * the auto-derived status. Pass via the ResourceManager `rowActions` prop.
 */
export function UnitStatusRowAction({ unitId }: UnitStatusRowActionProps) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const setStatus = useSetUnitStatus();

  const label = (a: ActionDef) => (language === "ar" ? a.ar : a.en);
  const title = language === "ar" ? "حالة الوحدة" : "Unit status";

  const apply = (code: StatusCode) => {
    setStatus.mutate(
      { id: unitId, data: { statusCode: code } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUnitsQueryKey() });
          toast({
            title: language === "ar" ? "تم تحديث الحالة" : "Status updated",
          });
        },
        onError: () => {
          toast({
            title: language === "ar" ? "حدث خطأ" : "Something went wrong",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={title}
          disabled={setStatus.isPending}
        >
          <CircleDot className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        {OVERRIDE_ACTIONS.map((a) => (
          <DropdownMenuItem key={a.code} onClick={() => apply(a.code)}>
            {label(a)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => apply(RELEASE_ACTION.code)}>
          {label(RELEASE_ACTION)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
