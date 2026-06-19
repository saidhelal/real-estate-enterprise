import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/language-provider";
import {
  useListSettings,
  useUpdateSettings,
  getListSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Marketing Settings: a focused editor for the `marketing` settings category
// (the same rows are also visible on the global System Settings page).
export default function MarketingSettingsPage() {
  const { t } = useLanguage();
  const { data: settings, isLoading } = useListSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [values, setValues] = useState<Record<string, string>>({});

  const marketingSettings = (settings ?? []).filter((s) => s.category === "marketing");

  useEffect(() => {
    if (settings) {
      const initial: Record<string, string> = {};
      settings
        .filter((s) => s.category === "marketing")
        .forEach((s) => {
          initial[s.key] = s.value;
        });
      setValues(initial);
    }
  }, [settings]);

  const handleSave = () => {
    const payload = {
      settings: Object.entries(values).map(([key, value]) => ({ key, value })),
    };
    updateSettings.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast({ title: t("settings.saved") });
          queryClient.invalidateQueries({ queryKey: getListSettingsQueryKey() });
        },
        onError: () => {
          toast({ title: t("settings.save_failed"), variant: "destructive" });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("nav.marketing_settings")}</h2>
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {t("common.save")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("nav.group.marketing")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {marketingSettings.length === 0 ? (
            <p className="text-muted-foreground">{t("lb.no_data")}</p>
          ) : (
            marketingSettings.map((setting) => (
              <div key={setting.key} className="space-y-2">
                <Label htmlFor={setting.key}>{setting.label}</Label>
                <Input
                  id={setting.key}
                  value={values[setting.key] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [setting.key]: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground font-mono">{setting.key}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
