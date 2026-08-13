import { useState } from "react";
import {
  useListCompanies,
  type AiAnalysisResult,
  type AiAnalysisSection,
  type AiAnalysisInput,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { useLanguage } from "@/lib/language-provider";
import { TONE_TEXT } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

type AnalysisMutation = {
  mutate: (variables: { data: AiAnalysisInput }) => void;
  data?: AiAnalysisResult;
  isPending: boolean;
  isError: boolean;
  error?: unknown;
};

function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

const SEVERITY_STYLES: Record<string, { border: string; icon: typeof Info; tone: string }> = {
  info: { border: "border-s-muted-foreground/40", icon: Info, tone: "text-muted-foreground" },
  positive: { border: "border-s-success", icon: CheckCircle2, tone: TONE_TEXT.success },
  warning: { border: "border-s-warning", icon: AlertTriangle, tone: TONE_TEXT.warning },
  critical: { border: "border-s-destructive", icon: ShieldAlert, tone: "text-destructive" },
};

export function AiAnalysisPage({
  titleKey,
  subtitleKey,
  useMutationHook,
}: {
  titleKey: string;
  subtitleKey: string;
  useMutationHook: () => AnalysisMutation;
}) {
  const { t, language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const mutation = useMutationHook();
  const [prompt, setPrompt] = useState("");

  const result = mutation.data;
  const noAccess = getErrorStatus(mutation.error) === 403;

  function run() {
    mutation.mutate({
      data: {
        companyId,
        prompt: prompt.trim() || undefined,
        language: language === "ar" ? "ar" : "en",
      },
    });
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={t(titleKey)}
          description={t(subtitleKey)}
          bordered={false}
        />
      </div>

      {noAccess ? (
        <Card className="border-warning-border/50">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-subtle">
              <ShieldAlert className={`h-6 w-6 ${TONE_TEXT.warning}`} />
            </div>
            <h3 className="text-lg font-semibold">{t("ai.no_access.title")}</h3>
            <p className="max-w-md text-sm text-muted-foreground">{t("ai.no_access.body")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("ai.prompt_placeholder")}
                className="flex-1"
              />
              <Button onClick={run} disabled={mutation.isPending} className="shrink-0">
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                ) : result ? (
                  <RefreshCw className="h-4 w-4 me-2" />
                ) : (
                  <Sparkles className="h-4 w-4 me-2" />
                )}
                {result ? t("ai.regenerate") : t("ai.generate")}
              </Button>
            </CardContent>
          </Card>

          {mutation.isPending && (
            <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("ai.generating")}
            </div>
          )}

          {mutation.isError && !mutation.isPending && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {t("ai.error")}
            </div>
          )}
        </>
      )}

      {!mutation.isPending && !mutation.isError && !result && (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          {t("ai.empty")}
        </div>
      )}

      {result && !mutation.isPending && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{result.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{result.summary}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
                <span>
                  {t("ai.generated_at")}: {new Date(result.generatedAt).toLocaleString()}
                </span>
                <span>
                  {t("ai.model")}: {result.model}
                </span>
              </div>
            </CardHeader>
          </Card>

          {!result.dataAvailable && (
            <div className={`rounded-lg border border-warning-border/50 bg-warning-subtle/40 px-4 py-3 text-sm ${TONE_TEXT.warning}`}>
              {t("ai.no_data")}
            </div>
          )}

          <div className="grid gap-3">
            {result.sections.map((s: AiAnalysisSection, i: number) => {
              const style = SEVERITY_STYLES[s.severity ?? "info"] ?? SEVERITY_STYLES.info;
              const Icon = style.icon;
              return (
                <Card key={i} className={cn("border-s-4", style.border)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className={cn("h-4 w-4", style.tone)} />
                      {s.heading}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{s.body}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
