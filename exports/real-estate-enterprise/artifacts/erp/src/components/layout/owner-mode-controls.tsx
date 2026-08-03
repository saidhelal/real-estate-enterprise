import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOwnerMode } from "@/lib/owner-mode-provider";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";

export function OwnerModeControls() {
  const { t } = useLanguage();
  const { active, busy, verify, exit } = useOwnerMode();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = await verify(username, password);
    if (err) {
      setError(err);
      return;
    }
    setOpen(false);
    setUsername("");
    setPassword("");
  };

  const onResetDemo = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/auth/owner-mode/reset-demo", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`reset-demo failed: ${res.status}`);
      // The demo schema was rebuilt, so every cached query is now stale.
      await queryClient.invalidateQueries();
      setResetOpen(false);
      toast({ title: t("owner.reset_done") });
    } catch {
      toast({ title: t("owner.reset_error"), variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  if (active) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || resetting}
          onClick={() => setResetOpen(true)}
          title={t("owner.reset_demo")}
          className="border-primary/40 text-primary hover:text-primary"
        >
          <RefreshCcw className="h-4 w-4" />
          <span className="hidden lg:inline">{t("owner.reset_demo")}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || resetting}
          onClick={() => void exit()}
          title={t("owner.exit")}
          className="border-primary/40 text-primary hover:text-primary"
        >
          <ShieldOff className="h-4 w-4" />
          <span className="hidden lg:inline">{t("owner.exit")}</span>
        </Button>

        <Dialog open={resetOpen} onOpenChange={(o) => !resetting && setResetOpen(o)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("owner.reset_demo_title")}</DialogTitle>
              <DialogDescription>{t("owner.reset_demo_body")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setResetOpen(false)}
                disabled={resetting}
              >
                {t("owner.cancel")}
              </Button>
              <Button onClick={() => void onResetDemo()} disabled={resetting}>
                {resetting ? t("owner.resetting") : t("owner.reset_demo_cta")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        title={t("owner.elevated_access")}
      >
        <ShieldCheck className="h-4 w-4" />
        <span className="hidden lg:inline">{t("owner.elevated_access")}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("owner.title")}</DialogTitle>
            <DialogDescription>{t("owner.subtitle")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="owner-username">{t("owner.username")}</Label>
              <Input
                id="owner-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner-password">{t("owner.password")}</Label>
              <Input
                id="owner-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "..." : t("owner.verify")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
