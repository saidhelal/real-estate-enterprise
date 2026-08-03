import { useEffect, useRef, useState } from "react";
import {
  useListAiConversations,
  useCreateAiConversation,
  useListAiMessages,
  getListAiConversationsQueryKey,
  getListAiMessagesQueryKey,
  type AiMessage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Send, Loader2, User, Sparkles, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/lib/language-provider";
import { cn } from "@/lib/utils";

type ChatLine = { role: "user" | "assistant"; content: string };

export function AiChatPage({
  feature,
  titleKey,
  subtitleKey,
}: {
  feature: string;
  titleKey: string;
  subtitleKey: string;
}) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const convoParams = { feature };
  const { data: conversations } = useListAiConversations(convoParams, {
    query: { queryKey: getListAiConversationsQueryKey(convoParams) },
  });
  const createConvo = useCreateAiConversation();

  const [activeId, setActiveId] = useState<number | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noAccess, setNoAccess] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Tracks the conversation whose messages are currently reflected in `lines`.
  // Guards the history-sync effect so a stale/empty server snapshot can never
  // overwrite locally authoritative (just-streamed or optimistic) messages.
  const loadedConvoRef = useRef<number | null>(null);

  const { data: history } = useListAiMessages(activeId ?? 0, {
    query: { enabled: !!activeId, queryKey: getListAiMessagesQueryKey(activeId ?? 0) },
  });

  useEffect(() => {
    // Only hydrate from server history when opening a DIFFERENT conversation
    // than the one already loaded. This prevents two clobbers: (1) the new
    // conversation's id is set mid-send, and (2) after a stream ends `history`
    // may still be a stale/empty snapshot — in both cases re-running this would
    // drop the live/streamed assistant reply.
    if (activeId && history && !streaming && loadedConvoRef.current !== activeId) {
      setLines(
        history.map((m: AiMessage) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      );
      loadedConvoRef.current = activeId;
    }
  }, [activeId, history, streaming]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, streaming]);

  function startNew() {
    setActiveId(null);
    setLines([]);
    setError(null);
    loadedConvoRef.current = null;
  }

  function isForbidden(err: unknown): boolean {
    return (
      !!err &&
      typeof err === "object" &&
      "status" in err &&
      (err as { status?: unknown }).status === 403
    );
  }

  async function ensureConversation(): Promise<number> {
    if (activeId) return activeId;
    const title = input.slice(0, 60) || t(titleKey);
    const convo = await createConvo.mutateAsync({ data: { title, feature } });
    setActiveId(convo.id);
    queryClient.invalidateQueries({ queryKey: getListAiConversationsQueryKey(convoParams) });
    return convo.id;
  }

  async function send() {
    const content = input.trim();
    if (!content || streaming) return;
    setError(null);
    setInput("");
    setLines((prev) => [...prev, { role: "user", content }, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const id = await ensureConversation();
      // These optimistic + streamed lines are now authoritative for this
      // conversation, so the history-sync effect must not overwrite them.
      loadedConvoRef.current = id;
      const res = await fetch(`/api/ai/conversations/${id}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ content }),
      });
      if (res.status === 403) {
        setNoAccess(true);
        setLines((prev) => {
          const next = [...prev];
          if (
            next.length &&
            next[next.length - 1].role === "assistant" &&
            !next[next.length - 1].content
          ) {
            next.pop();
          }
          return next;
        });
        return;
      }
      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamErr: string | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const dataLine = evt.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine.slice(5).trim());
            if (payload.delta) {
              setLines((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === "assistant") {
                  next[next.length - 1] = {
                    role: "assistant",
                    content: last.content + payload.delta,
                  };
                } else {
                  // The streaming placeholder was lost (e.g. the history sync
                  // effect replaced `lines` after a new conversation's id was
                  // set). Re-create an assistant line so deltas keep appending
                  // instead of crashing on an undefined entry.
                  next.push({ role: "assistant", content: payload.delta });
                }
                return next;
              });
            } else if (payload.error) {
              streamErr = payload.error;
            }
          } catch {
            // ignore malformed event chunk
          }
        }
      }
      if (streamErr) {
        setError(t("ai.error"));
      }
      queryClient.invalidateQueries({ queryKey: getListAiConversationsQueryKey(convoParams) });
      // Refetch the now-persisted messages so a later revisit shows the
      // server-authoritative thread. `loadedConvoRef` keeps the refetch from
      // clobbering the lines we just streamed for this same conversation.
      queryClient.invalidateQueries({ queryKey: getListAiMessagesQueryKey(id) });
    } catch (err) {
      if (isForbidden(err)) {
        setNoAccess(true);
      } else {
        setError(t("ai.error"));
      }
      setLines((prev) => {
        const next = [...prev];
        if (next.length && next[next.length - 1].role === "assistant" && !next[next.length - 1].content) {
          next.pop();
        }
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t(titleKey)}</h2>
          <p className="text-muted-foreground">{t(subtitleKey)}</p>
        </div>
        {!noAccess && (
          <Button variant="outline" size="sm" onClick={startNew}>
            <Plus className="h-4 w-4 me-2" />
            {t("ai.chat.new")}
          </Button>
        )}
      </div>

      {noAccess && (
        <Card className="border-amber-500/40">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
              <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold">{t("ai.no_access.title")}</h3>
            <p className="max-w-md text-sm text-muted-foreground">{t("ai.no_access.body")}</p>
          </CardContent>
        </Card>
      )}

      {!noAccess && (
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="hidden lg:block">
          <CardContent className="p-2">
            <p className="px-2 py-2 text-xs font-medium text-muted-foreground">{t("ai.chat.history")}</p>
            <ScrollArea className="h-[24rem]">
              <div className="space-y-1">
                {(conversations ?? []).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      "w-full truncate rounded-md px-3 py-2 text-start text-sm transition-colors hover:bg-accent",
                      activeId === c.id && "bg-accent font-medium",
                    )}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex h-[32rem] flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
            {lines.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                {t("ai.chat.empty")}
              </div>
            ) : (
              <div className="space-y-4">
                {lines.map((m, i) => (
                  <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                      )}
                    >
                      {m.role === "user" ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    </div>
                    <div
                      className={cn(
                        "max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      {m.content || (streaming && i === lines.length - 1 ? (
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {t("ai.chat.thinking")}
                        </span>
                      ) : (
                        ""
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="px-4 pb-2 text-sm text-destructive">{error}</p>}

          <div className="border-t p-3">
            <div className="flex items-end gap-2" dir={language === "ar" ? "rtl" : "ltr"}>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t("ai.chat.placeholder")}
                rows={1}
                className="min-h-[2.5rem] max-h-32 resize-none"
              />
              <Button onClick={send} disabled={streaming || !input.trim()} size="icon" className="shrink-0">
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="sr-only">{t("ai.chat.send")}</span>
              </Button>
            </div>
          </div>
        </Card>
      </div>
      )}
    </div>
  );
}
