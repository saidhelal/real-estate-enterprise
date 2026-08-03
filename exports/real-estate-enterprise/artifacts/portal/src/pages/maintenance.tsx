import { useState } from "react";
import { useListMaintenanceRequests, useCreateMaintenanceRequest, getListMaintenanceRequestsQueryKey, useGetPortalUnits, useGetPortalContracts, useUploadPortalFile } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Wrench, Plus, Paperclip } from "lucide-react";
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
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  unitId: z.string().optional(),
  contractId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function Maintenance() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const { data: requests, isLoading } = useListMaintenanceRequests();
  const { data: units } = useGetPortalUnits();
  const { data: contracts } = useGetPortalContracts();
  
  const createMutation = useCreateMaintenanceRequest();
  const uploadMutation = useUploadPortalFile();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject: "",
      description: "",
      category: "plumbing",
      priority: "medium",
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
        queryClient.invalidateQueries({ queryKey: getListMaintenanceRequestsQueryKey() });
        setOpen(false);
        form.reset();
        setFile(null);
      }
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500 text-white";
      case "high": return "bg-orange-500 text-white";
      case "medium": return "bg-blue-500 text-white";
      default: return "bg-slate-500 text-white";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("maintenance.title")}</h1>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("maintenance.create")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t("maintenance.create")}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("maintenance.subject")}</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g., AC not cooling" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="plumbing">Plumbing</SelectItem>
                            <SelectItem value="electrical">Electrical</SelectItem>
                            <SelectItem value="hvac">HVAC / AC</SelectItem>
                            <SelectItem value="carpentry">Carpentry</SelectItem>
                            <SelectItem value="appliances">Appliances</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="unitId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Related Unit (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {units?.map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.code}</SelectItem>
                          ))}
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Provide details about the issue..." 
                          className="min-h-[100px]"
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
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : !requests || requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card border-dashed">
          <Wrench className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <p className="text-lg font-medium text-muted-foreground mb-2">No maintenance requests</p>
          <Button variant="link" onClick={() => setOpen(true)}>Create your first request</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {requests.map((req) => (
            <Card key={req.id} className="overflow-hidden border-border/50 flex flex-col">
              <CardHeader className="bg-muted/30 pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base font-semibold">{req.subject}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">{req.code}</p>
                  </div>
                  <Badge variant={req.status === "resolved" ? "outline" : "default"} className="capitalize">
                    {req.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1 flex flex-col">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {req.description || "No description provided."}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="secondary" className="text-xs font-normal">
                      {req.category || "General"}
                    </Badge>
                    <Badge className={`text-xs font-normal border-none hover:bg-opacity-90 ${getPriorityColor(req.priority)}`}>
                      {req.priority || "Normal"} Priority
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50 text-xs text-muted-foreground">
                  <span>{format(new Date(req.createdAt), "MMM dd, yyyy")}</span>
                  {req.attachmentUrl && (
                    <a href={req.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
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
