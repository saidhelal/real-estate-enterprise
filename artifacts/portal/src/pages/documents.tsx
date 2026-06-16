import { useGetPortalDocuments } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Documents() {
  const { t } = useLanguage();
  const { data: documents, isLoading } = useGetPortalDocuments();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("documents.title")}</h1>
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("documents.title")}</h1>
      
      {!documents || documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card border-dashed">
          <p className="text-lg font-medium text-muted-foreground mb-2">No documents found</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="overflow-hidden border-border/50 hover:bg-muted/30 transition-colors">
              <CardContent className="p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-1">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-base">
                      {doc.docType || "Document"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {doc.docNumber || "N/A"}
                    </p>
                    {doc.issueDate && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Issued: {format(new Date(doc.issueDate), "MMM dd, yyyy")}
                      </p>
                    )}
                  </div>
                </div>
                
                {doc.fileUrl && (
                  <Button variant="outline" size="icon" asChild className="shrink-0">
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
