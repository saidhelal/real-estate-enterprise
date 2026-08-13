import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/language-provider";

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-surface-sunken">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-page-title text-foreground">{t("not_found.title")}</h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            {t("not_found.message")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
