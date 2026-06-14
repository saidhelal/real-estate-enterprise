import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/language-provider";
import { 
  useListSettings, 
  useUpdateSettings,
  getListSettingsQueryKey,
  Setting
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  const { t } = useLanguage();
  const { data: settings, isLoading } = useListSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) {
      const initialValues: Record<string, string> = {};
      settings.forEach(s => {
        initialValues[s.key] = s.value;
      });
      setValues(initialValues);
    }
  }, [settings]);

  const handleSave = () => {
    const payload = {
      settings: Object.entries(values).map(([key, value]) => ({ key, value }))
    };

    updateSettings.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast({ title: "Settings saved successfully" });
          queryClient.invalidateQueries({ queryKey: getListSettingsQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to save settings", variant: "destructive" });
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  // Group settings by category
  const groupedSettings = settings?.reduce((acc, curr) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {} as Record<string, Setting[]>) || {};

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h2>
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {t("common.save")}
        </Button>
      </div>

      <div className="grid gap-6">
        {Object.entries(groupedSettings).map(([category, items]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="capitalize">{category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map(setting => (
                <div key={setting.key} className="space-y-2">
                  <Label htmlFor={setting.key}>{setting.label}</Label>
                  <Input 
                    id={setting.key}
                    value={values[setting.key] ?? ""}
                    onChange={e => setValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground font-mono">{setting.key}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
