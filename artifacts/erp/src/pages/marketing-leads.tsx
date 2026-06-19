import { useState } from "react";
import { useLanguage } from "@/lib/language-provider";
import {
  useCreateMarketingLead,
  useListCompanies,
  useListBranches,
  useListLeadSources,
  useListMarketingCampaigns,
  useListMarketingChannels,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const NONE = "__none__";

// Marketing Lead Intake: captures a lead in the existing Sales Leads table with
// marketing attribution (campaign / channel / source) and, when "Auto-distribute"
// is on, runs the Smart Distribution Engine to assign an agent immediately.
export default function MarketingLeadsPage() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const { data: branches } = useListBranches();
  const { data: sources } = useListLeadSources();
  const { data: campaigns } = useListMarketingCampaigns();
  const { data: channels } = useListMarketingChannels();
  const createLead = useCreateMarketingLead();

  const empty = {
    fullName: "",
    phone: "",
    email: "",
    branchId: NONE,
    sourceId: NONE,
    campaignId: NONE,
    channelId: NONE,
    budget: "",
    notes: "",
  };
  const [form, setForm] = useState(empty);
  const [autoDistribute, setAutoDistribute] = useState(true);

  const set = (k: keyof typeof empty, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const pick = (v: string) => (v === NONE ? undefined : v);

  const handleSubmit = () => {
    if (!companyId) {
      toast({ title: t("leadintake.no_company"), variant: "destructive" });
      return;
    }
    if (!form.fullName.trim()) {
      toast({ title: t("leadintake.name_required"), variant: "destructive" });
      return;
    }
    createLead.mutate(
      {
        data: {
          companyId,
          fullName: form.fullName.trim(),
          phone: form.phone || undefined,
          email: form.email || undefined,
          branchId: pick(form.branchId),
          sourceId: pick(form.sourceId),
          campaignId: pick(form.campaignId),
          channelId: pick(form.channelId),
          budget: form.budget || undefined,
          notes: form.notes || undefined,
          autoDistribute,
        },
      },
      {
        onSuccess: () => {
          toast({ title: t("leadintake.created") });
          setForm(empty);
        },
        onError: () => {
          toast({ title: t("leadintake.failed"), variant: "destructive" });
        },
      },
    );
  };

  const nameOf = (r: { name?: string; nameAr?: string | null }) =>
    language === "ar" ? r.nameAr ?? r.name ?? "" : r.name ?? "";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("nav.marketing_leads")}</h2>
        <Button onClick={handleSubmit} disabled={createLead.isPending}>
          {t("leadintake.submit")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("leadintake.section_contact")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fullName">{t("leadintake.full_name")}</Label>
            <Input id="fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t("leadintake.phone")}</Label>
            <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("leadintake.email")}</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget">{t("leadintake.budget")}</Label>
            <Input id="budget" type="number" value={form.budget} onChange={(e) => set("budget", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("leadintake.branch")}</Label>
            <Select value={form.branchId} onValueChange={(v) => set("branchId", v)}>
              <SelectTrigger><SelectValue placeholder={t("leadintake.optional")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("leadintake.none")}</SelectItem>
                {(branches ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{nameOf(b)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("leadintake.section_attribution")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("leadintake.source")}</Label>
            <Select value={form.sourceId} onValueChange={(v) => set("sourceId", v)}>
              <SelectTrigger><SelectValue placeholder={t("leadintake.optional")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("leadintake.none")}</SelectItem>
                {(sources?.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{nameOf(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("leadintake.campaign")}</Label>
            <Select value={form.campaignId} onValueChange={(v) => set("campaignId", v)}>
              <SelectTrigger><SelectValue placeholder={t("leadintake.optional")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("leadintake.none")}</SelectItem>
                {(campaigns?.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{nameOf(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("leadintake.channel")}</Label>
            <Select value={form.channelId} onValueChange={(v) => set("channelId", v)}>
              <SelectTrigger><SelectValue placeholder={t("leadintake.optional")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("leadintake.none")}</SelectItem>
                {(channels?.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{nameOf(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">{t("leadintake.notes")}</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch id="autoDistribute" checked={autoDistribute} onCheckedChange={setAutoDistribute} />
            <Label htmlFor="autoDistribute" className="cursor-pointer">{t("leadintake.auto_distribute")}</Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
