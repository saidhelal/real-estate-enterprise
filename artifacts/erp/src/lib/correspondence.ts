import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

/**
 * Query hooks for internal correspondence.
 *
 * These endpoints sit outside the generated OpenAPI client, so the hooks are
 * written by hand — but they ride the same `customFetch` transport as every
 * generated call, which is what keeps the base URL, cookie handling, token
 * refresh and change-reason plumbing identical. A second fetch wrapper here
 * would silently lose all of it.
 */

export type MailboxView = "inbox" | "sent" | "drafts" | "archived" | "needs_reply";

export interface DirectoryEmployee {
  id: string;
  code: string;
  name: string;
  departmentId: string | null;
  managerEmployeeId: string | null;
  jobTitleId: string | null;
}

export interface CorrespondenceRecipient {
  id: string;
  employeeId: string;
  kind: "to" | "cc";
  readAt: string | null;
  deliveredAt: string | null;
  archivedAt: string | null;
}

export interface Correspondence {
  id: string;
  code: string;
  subject: string;
  body: string | null;
  priority: string;
  status: string;
  correspondenceKind: string | null;
  confidentiality: string | null;
  senderEmployeeId: string | null;
  threadId: string | null;
  parentId: string | null;
  replyDueDate: string | null;
  sentAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  recipients: CorrespondenceRecipient[];
}

export interface MailboxPage {
  data: Correspondence[];
  total: number;
  page: number;
  pageSize: number;
  view: MailboxView;
}

export interface DirectoryResponse {
  me: DirectoryEmployee;
  recipients: DirectoryEmployee[];
  leadership: { chairman: DirectoryEmployee[]; executiveDirector: DirectoryEmployee[] };
}

export interface ThreadResponse {
  correspondence: Correspondence;
  thread: Correspondence[];
  references: Array<{ id: string; documentId: string }>;
}

const BASE = "/api/internal-correspondence";

/** The key prefix every correspondence query shares, so one invalidate clears them all. */
export const correspondenceKey = ["internal-correspondence"] as const;

export interface MailboxParams {
  view: MailboxView;
  companyId?: string;
  search?: string;
  priority?: string;
  correspondenceKind?: string;
  page?: number;
  pageSize?: number;
}

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function useMailbox(params: MailboxParams, enabled = true) {
  return useQuery({
    queryKey: [...correspondenceKey, "mailbox", params],
    enabled,
    queryFn: () => customFetch<MailboxPage>(`${BASE}${qs({ ...params } as unknown as Record<string, unknown>)}`),
  });
}

export function useCorrespondenceThread(id: string | null) {
  return useQuery({
    queryKey: [...correspondenceKey, "thread", id],
    enabled: !!id,
    queryFn: () => customFetch<ThreadResponse>(`${BASE}/${id}`),
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
  return useQuery({
    queryKey: [...correspondenceKey, "directory", companyId],
    enabled: !!companyId,
    queryFn: () => customFetch<DirectoryResponse>(`${BASE}/directory${qs({ companyId })}`),
  });
}

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: [...correspondenceKey, "unread"],
    enabled,
    queryFn: () => customFetch<{ unread: number }>(`${BASE}/unread-count`),
  });
}

export interface ComposeInput {
  companyId: string;
  subject: string;
  body?: string;
  priority?: string;
  correspondenceKind?: string;
  replyDueDate?: string;
  to?: string[];
  cc?: string[];
  send?: boolean;
  parentId?: string;
  /** Guards against a double submit creating two official messages. */
  idempotencyKey?: string;
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: correspondenceKey });
    // A new message raises a notification, so the bell has to re-read too.
    void qc.invalidateQueries({ queryKey: ["/api/notifications-dashboard"] });
  };
}

export function useCompose() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: ComposeInput) =>
      customFetch<Correspondence & { replayed?: boolean }>(BASE, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useSendDraft() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => customFetch<Correspondence>(`${BASE}/${id}/send`, { method: "POST" }),
    onSuccess: invalidate,
  });
}

export function useForward() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, to, note }: { id: string; to: string[]; note?: string }) =>
      customFetch<Correspondence>(`${BASE}/${id}/forward`, {
        method: "POST",
        body: JSON.stringify({ to, note }),
      }),
    onSuccess: invalidate,
  });
}

export function useArchive() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<{ id: string }>(`${BASE}/${id}/archive`, { method: "POST" }),
    onSuccess: invalidate,
  });
}

export function useLinkDocument() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, documentId }: { id: string; documentId: string }) =>
      customFetch<{ correspondenceId: string }>(`${BASE}/${id}/documents`, {
        method: "POST",
        body: JSON.stringify({ documentId }),
      }),
    onSuccess: invalidate,
  });
}
