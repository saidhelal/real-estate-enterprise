import { useGetPortalCollections } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Receipt } from "lucide-react";

export default function Collections() {
  const { t } = useLanguage();
  const { data: collections, isLoading } = useGetPortalCollections();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("collections.title")}</h1>
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("collections.title")}</h1>
      
      {!collections || collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card border-dashed">
          <p className="text-lg font-medium text-muted-foreground mb-2">No payment history found</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {collections.map((collection) => (
            <Card key={collection.id} className="overflow-hidden border-border/50">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-base">
                      {collection.code || "Receipt"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {format(new Date(collection.paymentDate), "MMM dd, yyyy")}
                      {collection.method ? ` • ${collection.method}` : ""}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className="font-bold text-base text-primary">{Number(collection.amount).toLocaleString()}</span>
                  {collection.reference && (
                    <p className="text-xs text-muted-foreground mt-1 text-right">
                      Ref: {collection.reference}
                    </p>
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
