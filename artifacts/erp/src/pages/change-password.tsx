import { useState } from "react";
import { useLanguage } from "@/lib/language-provider";
import {
  useChangePassword,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ChangePasswordPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const changePassword = useChangePassword();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const validatePassword = (pass: string) => {
    if (pass.length < 8) return t("change_password.req_length");
    if (!/[A-Z]/.test(pass)) return t("change_password.req_upper");
    if (!/[a-z]/.test(pass)) return t("change_password.req_lower");
    if (!/[0-9]/.test(pass)) return t("change_password.req_number");
    return "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError(t("change_password.mismatch"));
      return;
    }

    const valError = validatePassword(newPassword);
    if (valError) {
      setError(valError);
      return;
    }

    changePassword.mutate(
      { data: { currentPassword, newPassword } },
      {
        onSuccess: () => {
          toast({ title: t("change_password.success") });
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        },
        onError: (err: any) => {
          toast({ 
            title: t("change_password.error"), 
            description: err?.message,
            variant: "destructive" 
          });
        }
      }
    );
  };

  return (
    <div className="max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("change_password.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {user?.mustChangePassword && (
              <div className="bg-warning-subtle text-warning-subtle-foreground px-3 py-2 rounded text-sm font-medium">
                {t("change_password.forced_notice")}
              </div>
            )}
            {error && (
              <div className="bg-destructive/10 text-destructive px-3 py-2 rounded text-sm font-medium">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("change_password.current")}</Label>
              <Input 
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("change_password.new")}</Label>
              <Input 
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t("change_password.hint")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("change_password.confirm")}</Label>
              <Input 
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={changePassword.isPending}>
              {t("change_password.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
