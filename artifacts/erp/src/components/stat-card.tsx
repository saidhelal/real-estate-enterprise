import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCard({
  title,
  value,
  icon: Icon,
  isLoading,
}: {
  title: string;
  value?: number | string;
  icon: any;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{title}</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-5 w-[50px]" />
          ) : (
            <p className="text-lg font-bold leading-tight">
              {typeof value === "number" ? value.toLocaleString() : value ?? 0}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
