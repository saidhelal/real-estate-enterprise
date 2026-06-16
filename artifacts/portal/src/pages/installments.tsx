import { useGetPortalInstallments } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function Installments() {
  const { t } = useLanguage();
  const { data: installments, isLoading } = useGetPortalInstallments();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("installments.title")}</h1>
        <div className="grid gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "overdue": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "due": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "overdue": return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("installments.title")}</h1>
      
      {!installments || installments.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card border-dashed">
          <p className="text-lg font-medium text-muted-foreground mb-2">No installments found</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {installments.map((installment) => (
            <Card key={installment.id} className={`overflow-hidden transition-all ${installment.status.toLowerCase() === 'overdue' ? 'border-red-200 dark:border-red-900/50' : 'border-border/50'}`}>
              <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${getStatusColor(installment.status)}`}>
                    #{installment.installmentNo || "-"}
                  </div>
                  <div>
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      {format(new Date(installment.dueDate), "MMM dd, yyyy")}
                      {getStatusIcon(installment.status)}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {installment.contractCode ? `Contract ${installment.contractCode}` : "Payment"}
                    </p>
                  </div>
                </div>
                
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                  <span className="font-bold text-lg">{Number(installment.amount).toLocaleString()}</span>
                  <Badge variant="outline" className={`border-none ${getStatusColor(installment.status)}`}>
                    {installment.status.toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
