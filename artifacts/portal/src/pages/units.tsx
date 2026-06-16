import { useGetPortalUnits } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Units() {
  const { t } = useLanguage();
  const { data: units, isLoading } = useGetPortalUnits();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("units.title")}</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("units.title")}</h1>
      
      {!units || units.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card border-dashed">
          <p className="text-lg font-medium text-muted-foreground mb-2">No units found</p>
          <p className="text-sm text-muted-foreground">You do not currently have any active units.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {units.map((unit) => (
            <Card key={unit.id} className="overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{unit.code}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{unit.unitType || "Unit"}</p>
                  </div>
                  <Badge variant={unit.status === "active" ? "default" : "secondary"}>
                    {unit.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("units.project")}</span>
                  <span className="font-medium text-right">{unit.projectName || "-"} {unit.buildingName ? `• ${unit.buildingName}` : ""}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("units.area")}</span>
                  <span className="font-medium">{unit.area ? `${unit.area} sqft` : "-"}</span>
                </div>
                {unit.price && (
                  <div className="flex justify-between pt-2 border-t border-border/50">
                    <span className="text-muted-foreground">{t("units.price")}</span>
                    <span className="font-semibold text-primary">{Number(unit.price).toLocaleString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
