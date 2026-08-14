import { useQueryClient } from "@tanstack/react-query";
import {
  useListInternalCorrespondence,
  useGetInternalCorrespondence,
  useGetCorrespondenceDirectory,
  useGetCorrespondenceUnreadCount,
  useComposeInternalCorrespondence,
  useSendInternalCorrespondenceDraft,
  useForwardInternalCorrespondence,
  useArchiveInternalCorrespondence,
  useLinkCorrespondenceDocument,
  getListInternalCorrespondenceQueryKey,
  getGetInternalCorrespondenceQueryKey,
  getGetCorrespondenceDirectoryQueryKey,
  getGetCorrespondenceUnreadCountQueryKey,
  type ListInternalCorrespondenceParams,
  type InternalCorrespondence,
  type CorrespondenceMailboxPage,
  type CorrespondenceThread,
  type CorrespondenceDirectory,
  type CorrespondenceDirectoryEmployee,
  type CorrespondenceRecipientEntry,
  type ComposeCorrespondenceInput,
} from "@workspace/api-client-react";

/**
 * Internal correspondence — the domain layer over the generated contract.
 *
 * Every type and every request here now comes from `openapi.yaml` through the
 * generated client. This file used to declare its own interfaces and call
 * `customFetch` by hand, which meant the shape of a message was written down
 * twice — once in the spec the server validates against, once here — and
 * nothing checked that the two agreed.
 *
 * What stays is the part that is genuinely this module's, and that the
 * generated code has no way to know: composing a message raises a
 * notification, so the header bell has to re-read as well as the mailbox. That
 * is a business consequence, not API typing, so it belongs on this side of the
 * line rather than inside generated code.
 */

/** Which mailbox a list request is asking for. */
export type MailboxView = "inbox" | "sent" | "drafts" | "archived" | "needs_reply";

// Re-exported so screens import their types from the module they belong to,
// without re-declaring any of them.
export type {
  InternalCorrespondence,
  CorrespondenceMailboxPage,
  CorrespondenceThread,
  CorrespondenceDirectory,
  CorrespondenceDirectoryEmployee,
  CorrespondenceRecipientEntry,
  ComposeCorrespondenceInput,
  ListInternalCorrespondenceParams,
};

/**
 * Everything this module caches.
 *
 * Built from the generated key builders rather than a string of our own, so
 * invalidation cannot miss a query whose key the generator decides.
 */
function correspondenceQueryRoots(): string[] {
  return [
    getListInternalCorrespondenceQueryKey()[0],
    getGetCorrespondenceUnreadCountQueryKey()[0],
    getGetCorrespondenceDirectoryQueryKey({ companyId: "" })[0],
    getGetInternalCorrespondenceQueryKey("")[0],
  ];
}

/**
 * Refresh what a write changes.
 *
 * The mailbox and the unread badge are this module's own. The notifications
 * dashboard is not — but a new message raises a notification, so leaving it
 * stale would show a bell that disagrees with the inbox beside it.
 */
function useInvalidate(): () => void {
  const qc = useQueryClient();
  return () => {
    // Prefix matching: one call covers every page, view and filter combination
    // of a list query without enumerating them.
    for (const root of correspondenceQueryRoots()) {
      void qc.invalidateQueries({ queryKey: [root] });
    }
    void qc.invalidateQueries({ queryKey: ["/api/notifications-dashboard"] });
  };
}

/* ---- Reads ---------------------------------------------------------------
 * Straight through to the generated hooks. They are re-exported under this
 * module's names so screens keep reading as domain code, and so a screen never
 * has to know which generated symbol backs which mailbox.
 */

export function useMailbox(params: ListInternalCorrespondenceParams, enabled = true) {
  return useListInternalCorrespondence(params, {
    query: { enabled, queryKey: getListInternalCorrespondenceQueryKey(params) },
  });
}

export function useCorrespondenceThread(id: string | null) {
  return useGetInternalCorrespondence(id ?? "", {
    query: { enabled: !!id, queryKey: getGetInternalCorrespondenceQueryKey(id ?? "") },
  });
}

/**
 * The recipients this user may write to.
 *
 * Comes from the server's directory rather than a client-side employee list:
 * the picker must offer exactly what the server will accept, or a user is
 * invited to compose a message that is then refused on send.
 */
export function useDirectory(companyId?: string) {
  const params = { companyId: companyId ?? "" };
  return useGetCorrespondenceDirectory(params, {
    query: { enabled: !!companyId, queryKey: getGetCorrespondenceDirectoryQueryKey(params) },
  });
}

export function useUnreadCount(enabled = true) {
  return useGetCorrespondenceUnreadCount({
    query: { enabled, queryKey: getGetCorrespondenceUnreadCountQueryKey() },
  });
}

/* ---- Writes --------------------------------------------------------------
 * The generated mutation, plus the cross-module refresh it should trigger.
 */

export function useCompose() {
  const invalidate = useInvalidate();
  return useComposeInternalCorrespondence({ mutation: { onSuccess: invalidate } });
}

export function useSendDraft() {
  const invalidate = useInvalidate();
  return useSendInternalCorrespondenceDraft({ mutation: { onSuccess: invalidate } });
}

export function useForward() {
  const invalidate = useInvalidate();
  return useForwardInternalCorrespondence({ mutation: { onSuccess: invalidate } });
}

export function useArchive() {
  const invalidate = useInvalidate();
  return useArchiveInternalCorrespondence({ mutation: { onSuccess: invalidate } });
}

export function useLinkDocument() {
  const invalidate = useInvalidate();
  return useLinkCorrespondenceDocument({ mutation: { onSuccess: invalidate } });
}
