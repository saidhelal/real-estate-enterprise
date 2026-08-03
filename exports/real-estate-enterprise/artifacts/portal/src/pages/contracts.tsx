import { useGetPortalContracts } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Contracts() {
  const { t } = useLanguage();
  const { data: contracts, isLoading } = useGetPortalContracts();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("contracts.title")}</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("contracts.title")}</h1>
      
      {!contracts || contracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card border-dashed">
          <p className="text-lg font-medium text-muted-foreground mb-2">No contracts found</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contracts.map((contract) => (
            <Card key={contract.id} className="overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg text-primary">{contract.code}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {contract.unitCode ? `Unit ${contract.unitCode}` : "Contract"}
                    </p>
                  </div>
                  <Badge variant={contract.status === "active" ? "default" : "secondary"}>
                    {contract.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{format(new Date(contract.contractDate), "MMM dd, yyyy")}</span>
                </div>
                {contract.downPayment && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Down Payment</span>
                    <span className="font-medium">{Number(contract.downPayment).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-border/50">
                  <span className="text-muted-foreground">Total Price</span>
                  <span className="font-semibold text-primary">{Number(contract.totalPrice).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
