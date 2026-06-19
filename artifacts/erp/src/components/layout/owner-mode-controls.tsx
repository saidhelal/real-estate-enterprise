import { useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
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

export function OwnerModeControls() {
  const { t } = useLanguage();
  const { active, busy, verify, exit } = useOwnerMode();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  if (active) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void exit()}
        title={t("owner.exit")}
        className="border-primary/40 text-primary hover:text-primary"
      >
        <ShieldOff className="h-4 w-4" />
        <span className="hidden lg:inline">{t("owner.exit")}</span>
      </Button>
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
