import { useState } from "react";
import { useListComplaints, useCreateComplaint, getListComplaintsQueryKey, useUploadPortalFile } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { MessageSquareWarning, Plus, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const schema = z.object({
  subject: z.string().min(1, "Subject is required"),
  description: z.string().optional(),
  category: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function Complaints() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const { data: complaints, isLoading } = useListComplaints();
  
  const createMutation = useCreateComplaint();
  const uploadMutation = useUploadPortalFile();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject: "",
      description: "",
      category: "service",
    },
  });

  const onSubmit = async (values: FormValues) => {
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
      } finally {
        setUploading(false);
      }
    }
    
    createMutation.mutate({ 
      data: { ...values, attachmentUrl } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
        setOpen(false);
        form.reset();
        setFile(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("complaints.title")}</h1>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("complaints.create")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t("complaints.create")}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Brief description of your complaint" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="service">Service Quality</SelectItem>
                          <SelectItem value="billing">Billing & Payments</SelectItem>
                          <SelectItem value="facilities">Facilities & Amenities</SelectItem>
                          <SelectItem value="staff">Staff Behavior</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Details</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Please provide as much detail as possible..." 
                          className="min-h-[120px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-2">
                  <FormLabel>Attachment (Optional)</FormLabel>
                  <Input 
                    type="file" 
                    onChange={(e) => setFile(e.target.files?.[0] || null)} 
                  />
                </div>

                <div className="pt-4 flex justify-end gap-2">
                  <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || uploading}>
                    {createMutation.isPending || uploading ? t("common.loading") : t("common.save")}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : !complaints || complaints.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card border-dashed">
          <MessageSquareWarning className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <p className="text-lg font-medium text-muted-foreground mb-2">No complaints filed</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {complaints.map((comp) => (
            <Card key={comp.id} className="overflow-hidden border-border/50 flex flex-col">
              <CardHeader className="bg-muted/30 pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base font-semibold">{comp.subject}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">{comp.code}</p>
                  </div>
                  <Badge variant={comp.status === "resolved" ? "outline" : "destructive"} className="capitalize">
                    {comp.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1 flex flex-col">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {comp.description || "No description provided."}
                  </p>
                  
                  <Badge variant="secondary" className="text-xs font-normal mb-4">
                    {comp.category || "General"}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50 text-xs text-muted-foreground">
                  <span>{format(new Date(comp.createdAt), "MMM dd, yyyy")}</span>
                  {comp.attachmentUrl && (
                    <a href={comp.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                      <Paperclip className="h-3 w-3" />
                      Attachment
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
