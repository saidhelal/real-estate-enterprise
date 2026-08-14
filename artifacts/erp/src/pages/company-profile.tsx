import { useEffect, useMemo, useState } from "react";
import {
  useListCompanies,
  useUpdateCompany,
  getListCompaniesQueryKey,
  type Company,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { Toolbar, ToolbarStart, ToolbarEnd } from "@/components/ui/toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeclareScreenContext } from "@/lib/screen-context";
import { Building2, Save, RotateCcw, ShieldAlert } from "lucide-react";

/**
 * The company's institutional record.
 *
 * This screen edits the company row itself — the same row every print
 * template, letterhead, contract and report resolves its company values from.
 * There is no separate "profile" store: a second copy would be one more place
 * for the legal name to be wrong.
 *
 * Which company is shown is not a choice made here. The server returns the
 * caller's own company (a user pinned to a company sees exactly one), so this
 * screen renders what it is given rather than offering a picker that could be
 * pointed somewhere it has no right to be.
 */

/** A field on the form: which key it writes, and how it should be rendered. */
type Field = {
  key: keyof Company & string;
  labelKey: string;
  type?: "text" | "area";
  /** Written into the print output, so worth flagging in the UI. */
  onPrint?: boolean;
};

type Section = { titleKey: string; hintKey?: string; fields: Field[] };

const SECTIONS: Section[] = [
  {
    titleKey: "cp.section.identity",
    fields: [
      { key: "nameAr", labelKey: "cp.name_ar", onPrint: true },
      { key: "name", labelKey: "cp.name_en", onPrint: true },
      { key: "legalNameAr", labelKey: "cp.legal_name_ar", onPrint: true },
      { key: "legalName", labelKey: "cp.legal_name_en", onPrint: true },
      { key: "tradeName", labelKey: "cp.trade_name" },
      { key: "legalForm", labelKey: "cp.legal_form" },
    ],
  },
  {
    titleKey: "cp.section.registration",
    fields: [
      { key: "taxNumber", labelKey: "cp.tax_number", onPrint: true },
      { key: "commercialRegister", labelKey: "cp.commercial_register", onPrint: true },
    ],
  },
  {
    titleKey: "cp.section.contact",
    fields: [
      { key: "phone", labelKey: "cp.phone", onPrint: true },
      { key: "fax", labelKey: "cp.fax" },
      { key: "email", labelKey: "cp.email" },
      { key: "officialEmail", labelKey: "cp.official_email" },
      { key: "website", labelKey: "cp.website" },
      { key: "poBox", labelKey: "cp.po_box" },
      { key: "address", labelKey: "cp.address", type: "area", onPrint: true },
    ],
  },
  {
    titleKey: "cp.section.representative",
    hintKey: "cp.section.representative_hint",
    fields: [
      { key: "representativeName", labelKey: "cp.representative_name" },
      { key: "representativeTitle", labelKey: "cp.representative_title" },
    ],
  },
  {
    titleKey: "cp.section.print",
    hintKey: "cp.section.print_hint",
    fields: [
      { key: "logoUrl", labelKey: "cp.logo_url" },
      { key: "printHeader", labelKey: "cp.print_header", type: "area" },
      { key: "printFooter", labelKey: "cp.print_footer", type: "area" },
    ],
  },
];

const ALL_KEYS = SECTIONS.flatMap((s) => s.fields.map((f) => f.key));

/** The form's working copy: every editable field as a string. */
type Draft = Record<string, string>;

function draftFrom(company: Company): Draft {
  const d: Draft = {};
  for (const key of ALL_KEYS) {
    const v = (company as unknown as Record<string, unknown>)[key];
    d[key] = typeof v === "string" ? v : "";
  }
  return d;
}

export default function CompanyProfilePage() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: companies, isLoading, isError } = useListCompanies();
  const company = companies?.[0];

  const [draft, setDraft] = useState<Draft>({});
  const save = useUpdateCompany();

  // Reset the form whenever the stored record changes, so a save elsewhere is
  // not silently overwritten by a stale draft still sitting in this tab.
  useEffect(() => {
    if (company) setDraft(draftFrom(company));
  }, [company]);

  useDeclareScreenContext({
    moduleKey: "generalAdmin",
    documentType: "company_profile",
    entityId: company?.id,
    label: company ? (language === "ar" ? company.nameAr : company.name) : undefined,
    documentNumber: company?.code,
  });

  const dirtyKeys = useMemo(() => {
    if (!company) return [];
    const original = draftFrom(company);
    return ALL_KEYS.filter((k) => (draft[k] ?? "") !== original[k]);
  }, [company, draft]);
  const isDirty = dirtyKeys.length > 0;

  const set = (key: string, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const handleSave = () => {
    if (!company || !isDirty) return;
    // Only what actually changed is sent. An empty string means "clear this",
    // which the API models as null — sending "" instead would store a blank
    // that reads as set but prints as nothing.
    const payload: Record<string, string | null> = {};
    for (const key of dirtyKeys) {
      const value = draft[key]?.trim() ?? "";
      payload[key] = value === "" ? null : value;
    }
    // The company must be called something; the server enforces this too.
    if (payload.name === null || payload.nameAr === null) {
      toast({ title: t("cp.name_required"), variant: "destructive" });
      return;
    }
    save.mutate(
      { id: company.id, data: payload },
      {
        onSuccess: () => {
          toast({ title: t("cp.saved") });
          queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
        },
        onError: (err: unknown) => {
          toast({
            title: t("common.error"),
            description: err instanceof Error ? err.message : undefined,
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isLoading) return <LoadingState label={t("common.loading")} />;
  if (isError || !company) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t("cp.unavailable")}
        description={t("cp.unavailable_hint")}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("nav.company_profile")}
        description={t("cp.description")}
        bordered={false}
      />

      <Toolbar>
        <ToolbarStart>
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{language === "ar" ? company.nameAr : company.name}</span>
          <Badge variant="secondary">{company.code}</Badge>
          {isDirty ? (
            <Badge variant="outline">{`${dirtyKeys.length} ${t("cp.unsaved")}`}</Badge>
          ) : null}
        </ToolbarStart>
        <ToolbarEnd>
          <Button
            variant="outline"
            size="sm"
            disabled={!isDirty || save.isPending}
            onClick={() => setDraft(draftFrom(company))}
          >
            <RotateCcw className="h-4 w-4 me-1" />
            {t("common.reset")}
          </Button>
          <Button size="sm" disabled={!isDirty || save.isPending} onClick={handleSave}>
            <Save className="h-4 w-4 me-1" />
            {save.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </ToolbarEnd>
      </Toolbar>

      <div className="grid gap-4 lg:grid-cols-2">
        {SECTIONS.map((section) => (
          <Card key={section.titleKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t(section.titleKey)}</CardTitle>
              {section.hintKey ? (
                <p className="text-xs text-muted-foreground">{t(section.hintKey)}</p>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {section.fields.map((field) => {
                const changed = dirtyKeys.includes(field.key);
                return (
                  <div
                    key={field.key}
                    className={`space-y-2 ${field.type === "area" ? "sm:col-span-2" : ""}`}
                  >
                    <Label htmlFor={`cp-${field.key}`} className="flex items-center gap-2">
                      {t(field.labelKey)}
                      {field.onPrint ? (
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {t("cp.on_print")}
                        </span>
                      ) : null}
                      {changed ? <span className="h-1.5 w-1.5 rounded-full bg-warning" /> : null}
                    </Label>
                    {field.type === "area" ? (
                      <Textarea
                        id={`cp-${field.key}`}
                        rows={3}
                        value={draft[field.key] ?? ""}
                        onChange={(e) => set(field.key, e.target.value)}
                      />
                    ) : (
                      <Input
                        id={`cp-${field.key}`}
                        value={draft[field.key] ?? ""}
                        onChange={(e) => set(field.key, e.target.value)}
                      />
                    )}
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
