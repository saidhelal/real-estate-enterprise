import { useEffect, useRef, useState } from "react";
import {
  useCreateAiConversation,
  getListAiConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2, User, X, ShieldAlert, Plus } from "lucide-react";
import { useLanguage } from "@/lib/language-provider";
import { cn } from "@/lib/utils";
import { AssistantMessage } from "@/components/ai/assistant-message";

type ChatLine = { role: "user" | "assistant"; content: string };

const FEATURE = "enterprise";

export function EnterpriseAssistant() {
  const { t, language, dir } = useLanguage();
  const queryClient = useQueryClient();
  const createConvo = useCreateAiConversation();

  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noAccess, setNoAccess] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const convoParams = { feature: FEATURE };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, streaming]);

  function startNew() {
    setActiveId(null);
    setLines([]);
    setError(null);
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
    const title = input.slice(0, 60) || t("ai.enterprise.title");
    const convo = await createConvo.mutateAsync({ data: { title, feature: FEATURE } });
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
                next[next.length - 1] = {
                  role: "assistant",
                  content: next[next.length - 1].content + payload.delta,
                };
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
    <>
      {/* The launcher lives in the header beside the language toggle, so it
          reads as one of the shell's controls and takes the same ghost icon
          shape as its neighbours. It used to float over the bottom corner,
          where it covered whatever the page put there — pagination, a save
          bar, the last row of a table. */}
      <Button
        onClick={() => setOpen(true)}
        variant="ghost"
        size="icon"
        title={t("ai.enterprise.open")}
      >
        <Sparkles className="h-5 w-5" />
        <span className="sr-only">{t("ai.enterprise.open")}</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={dir === "rtl" ? "left" : "right"}
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">{t("ai.enterprise.title")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("ai.enterprise.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!noAccess && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startNew} title={t("ai.chat.new")}>
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">{t("ai.chat.new")}</span>
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
                <span className="sr-only">{t("ai.chat.close")}</span>
              </Button>
            </div>
          </div>

          {noAccess ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-subtle">
                <ShieldAlert className="h-6 w-6 text-warning-subtle-foreground" />
              </div>
              <h3 className="text-base font-semibold">{t("ai.no_access.title")}</h3>
              <p className="max-w-xs text-sm text-muted-foreground">{t("ai.no_access.body")}</p>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
                {lines.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                    {t("ai.enterprise.empty")}
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
                            "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                            m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                          )}
                        >
                          {m.content ? (
                            m.role === "assistant" ? (
                              <AssistantMessage content={m.content} onNavigate={() => setOpen(false)} />
                            ) : (
                              <span className="whitespace-pre-wrap">{m.content}</span>
                            )
                          ) : streaming && i === lines.length - 1 ? (
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              {t("ai.chat.thinking")}
                            </span>
                          ) : (
                            ""
                          )}
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
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
