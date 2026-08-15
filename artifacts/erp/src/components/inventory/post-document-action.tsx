import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language-provider";

/**
 * Committing a document, from the register that lists it.
 *
 * Five documents commit the same way — four stock movements and a goods
 * receipt note — and each one is a single call, a refresh, and the server's
 * own words if it refuses. Written into each screen that would be five copies
 * of the same handler and five chances for one of them to swallow the refusal.
 *
 * The refusal matters more than the success here. "Only 25 of CEM-001 (Cement
 * bag) is in this warehouse; the document asks for 9999" is the whole reason a
 * storekeeper can fix the problem without calling anyone, and a generic
 * "something went wrong" would throw it away.
 */

interface DocumentActionButtonProps {
  /** The generated mutation hook's result, e.g. `usePostGoodsReceipt()`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutation: any;
  id: string;
  /** The list query to refresh once the document has taken effect. */
  queryKey: readonly unknown[];
  /** Extra queries the action changes — the ledger, a dashboard. */
  alsoInvalidate?: Array<readonly unknown[]>;
  /** i18n keys, so the button says what this particular action does. */
  label?: string;
  successLabel?: string;
  failureLabel?: string;
}

export function DocumentActionButton({
  mutation,
  id,
  queryKey,
  alsoInvalidate = [],
  label = "inventory.post",
  successLabel = "inventory.posted",
  failureLabel = "inventory.post_failed",
}: DocumentActionButtonProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const run = () => {
    mutation.mutate(
      { id },
      {
        onSuccess: (result: { movements?: number; linesUpdated?: number }) => {
          // Say what actually happened. "Saved" tells a storekeeper nothing;
          // "12 stock movements recorded" is something they can check.
          const detail =
            typeof result?.movements === "number"
              ? t("inventory.movements_written").replace("{count}", String(result.movements))
              : typeof result?.linesUpdated === "number"
                ? t("procurement.lines_matched").replace("{count}", String(result.linesUpdated))
                : undefined;
          toast({ title: t(successLabel), description: detail });
          queryClient.invalidateQueries({ queryKey });
          for (const key of alsoInvalidate) queryClient.invalidateQueries({ queryKey: key });
        },
        onError: (err: unknown) => {
          // The server explains why — not enough stock, already posted, more
          // than was ordered. Replacing that with our own message would discard
          // the only part that tells the user what to do next.
          const data = (err as { data?: { error?: string } } | null)?.data;
          toast({
            title: t(failureLabel),
            description: data?.error ?? (err as Error)?.message,
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Button variant="outline" size="sm" disabled={mutation.isPending} onClick={run}>
      {t(label)}
    </Button>
  );
}

/** The stock-posting preset, which is what four of the five screens want. */
export function PostDocumentAction(props: Omit<DocumentActionButtonProps, "label">) {
  return <DocumentActionButton {...props} />;
}
