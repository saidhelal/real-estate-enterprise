import { useState, useRef, useEffect } from "react";
import { useGetSupportTicket, useCreateSupportTicketMessage, getGetSupportTicketQueryKey, useUploadPortalFile } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ArrowLeft, Send, Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { useAuth } from "@/lib/auth-provider";

export default function SupportTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, dir } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const { data: detail, isLoading } = useGetSupportTicket(id || "");
  const createMessageMutation = useCreateSupportTicketMessage();
  const uploadMutation = useUploadPortalFile();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [detail?.messages]);

  if (isLoading || !id) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto h-[calc(100vh-10rem)] flex flex-col">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <div className="flex-1 mt-4">
          <Skeleton className="h-full w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return <div>Ticket not found</div>;
  }

  const { ticket, messages } = detail;
  const isClosed = ticket.status === "closed";

  const handleSendMessage = async () => {
    if (!message.trim() && !file) return;

    let attachmentUrl = undefined;
    
    if (file) {
      setUploading(true);
      try {
        const uploadRes = await uploadMutation.mutateAsync({
          data: {
            fileName: file.name,
            contentType: file.type,
          }
        });
        
        await fetch(uploadRes.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });
        
        attachmentUrl = uploadRes.fileUrl;
      } catch (err) {
        console.error("Upload failed", err);
        setUploading(false);
        return; // Don't send message if upload fails
      }
    }

    createMessageMutation.mutate({
      id,
      data: {
        body: message,
        attachmentUrl
      }
    }, {
      onSuccess: () => {
        setMessage("");
        setFile(null);
        setUploading(false);
        queryClient.invalidateQueries({ queryKey: getGetSupportTicketQueryKey(id) });
      },
      onError: () => {
        setUploading(false);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col bg-card border rounded-xl overflow-hidden shadow-sm">
      {/* Header Info */}
      <div className="p-4 sm:p-6 border-b border-border/50 bg-muted/30 shrink-0">
        <Link href="/support" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Tickets
        </Link>
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold">{ticket.subject}</h1>
              <Badge variant={isClosed ? "secondary" : "default"} className="capitalize">
                {ticket.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono bg-background px-1.5 py-0.5 rounded border">{ticket.code}</span>
              <span>Opened {format(new Date(ticket.createdAt), "MMM dd, yyyy")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 p-4 sm:p-6 overflow-y-auto bg-background flex flex-col gap-6"
      >
        {messages?.map((msg) => {
          const isCustomer = msg.authorType === "customer";
          return (
            <div key={msg.id} className={`flex flex-col max-w-[85%] ${isCustomer ? 'self-end items-end' : 'self-start items-start'}`}>
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-xs font-medium text-foreground">
                  {isCustomer ? "You" : (msg.authorName || "Support Agent")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(msg.createdAt), "MMM dd, hh:mm a")}
                </span>
              </div>
              <div 
                className={`p-3 sm:p-4 rounded-2xl ${
                  isCustomer 
                    ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                    : 'bg-muted/50 border border-border/50 text-foreground rounded-tl-sm'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm">{msg.body}</div>
                
                {msg.attachmentUrl && (
                  <div className={`mt-3 pt-3 border-t ${isCustomer ? 'border-primary-foreground/20' : 'border-border'} flex items-center`}>
                    <a 
                      href={msg.attachmentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-1.5 text-xs hover:underline font-medium"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      View Attachment
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      {!isClosed && (
        <div className="p-4 border-t border-border/50 bg-card shrink-0">
          {file && (
            <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-md text-sm w-max max-w-full">
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{file.name}</span>
              <button 
                className="ml-2 text-muted-foreground hover:text-destructive shrink-0" 
                onClick={() => setFile(null)}
              >
                &times;
              </button>
            </div>
          )}
          
          <div className="flex items-end gap-2 relative">
            <div className="flex-1 relative">
              <Textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="min-h-[60px] max-h-[200px] resize-y pb-10 pr-12 bg-background"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <div className="absolute bottom-2 left-2">
                <input 
                  type="file" 
                  id="file-upload" 
                  className="hidden" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)} 
                />
                <label 
                  htmlFor="file-upload" 
                  className="p-1.5 inline-flex text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-muted transition-colors"
                >
                  <Paperclip className="h-4 w-4" />
                </label>
              </div>
            </div>
            <Button 
              onClick={handleSendMessage} 
              disabled={(!message.trim() && !file) || createMessageMutation.isPending || uploading}
              className="h-[60px] px-6 shrink-0"
            >
              {createMessageMutation.isPending || uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Send className="h-5 w-5 sm:mr-2" />
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
      
      {isClosed && (
        <div className="p-4 bg-muted/50 text-center text-sm text-muted-foreground shrink-0 border-t border-border/50">
          This ticket has been closed. If you need further assistance, please open a new ticket.
        </div>
      )}
    </div>
  );
}
