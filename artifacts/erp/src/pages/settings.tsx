import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/language-provider";
import { PageHeader } from "@/components/ui/page-header";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AI_PROVIDER_SETTING_KEY = "ai.provider";
const AI_MODEL_SETTING_KEY = "ai.model";

const AI_PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "gemini", label: "Gemini" },
];

// Suggested models per provider. OpenRouter exposes a long tail of models, so it
// is left free-form (any other provider with an empty list behaves the same).
const AI_MODEL_OPTIONS: Record<string, string[]> = {
  openai: ["gpt-5", "gpt-5-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"],
  gemini: ["gemini-3.1-pro-preview", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash"],
  openrouter: [],
};

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
          toast({ title: t("settings.saved") });
          queryClient.invalidateQueries({ queryKey: getListSettingsQueryKey() });
        },
        onError: () => {
          toast({ title: t("settings.save_failed"), variant: "destructive" });
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
        <PageHeader title={t("settings.title")} bordered={false} />
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
              {items.map(setting => {
                const setValue = (value: string) =>
                  setValues(prev => ({ ...prev, [setting.key]: value }));
                const current = values[setting.key] ?? "";

                let control;
                if (setting.key === AI_PROVIDER_SETTING_KEY) {
                  control = (
                    <Select value={current} onValueChange={setValue}>
                      <SelectTrigger id={setting.key}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_PROVIDER_OPTIONS.map(p => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                } else if (setting.key === AI_MODEL_SETTING_KEY) {
                  const provider = values[AI_PROVIDER_SETTING_KEY] ?? "openai";
                  const suggestions = AI_MODEL_OPTIONS[provider] ?? [];
                  // Always include the current value so a custom/seeded model isn't lost.
                  const options =
                    current && !suggestions.includes(current)
                      ? [current, ...suggestions]
                      : suggestions;
                  control =
                    options.length > 0 ? (
                      <Select value={current} onValueChange={setValue}>
                        <SelectTrigger id={setting.key}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map(model => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={setting.key}
                        value={current}
                        onChange={e => setValue(e.target.value)}
                      />
                    );
                } else {
                  control = (
                    <Input
                      id={setting.key}
                      value={current}
                      onChange={e => setValue(e.target.value)}
                    />
                  );
                }

                return (
                  <div key={setting.key} className="space-y-2">
                    <Label htmlFor={setting.key}>{setting.label}</Label>
                    {control}
                    <p className="text-xs text-muted-foreground font-mono">{setting.key}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
