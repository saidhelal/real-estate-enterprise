import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCompanies,
  useListProjects,
  useListUnitStatuses,
  useCreateProject,
  useCreatePhase,
  useCreateBuilding,
  useCreateFloor,
  useCreateUnit,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import {
  BUILDING_TYPES,
  buildingTypeCode,
  buildingTypeLabel,
  buildFloorDescriptors,
  computePricing,
  countDraft,
  defaultFloorSpec,
  emptyDraft,
  makeUnit,
  money,
  reindexBuilding,
  uid,
  unitFullCode,
  type DiscountType,
  type PaymentOption,
  type CollectionMethod,
  type DraftBuilding,
  type DraftFloor,
  type DraftPhase,
  type DraftState,
  type FloorSpec,
} from "@/lib/data-entry";

const STEPS = [
  { key: "project", en: "Project", ar: "المشروع" },
  { key: "phases", en: "Phases", ar: "المراحل" },
  { key: "buildings", en: "Buildings", ar: "المباني" },
  { key: "floors", en: "Floors", ar: "الطوابق" },
  { key: "units", en: "Units", ar: "الوحدات" },
  { key: "pricing", en: "Pricing & Sales Setup", ar: "التسعير وإعداد المبيعات" },
  { key: "availability", en: "Availability", ar: "الإتاحة" },
  { key: "review", en: "Review", ar: "المراجعة" },
] as const;

interface FlatBuilding {
  phase: DraftPhase;
  building: DraftBuilding;
}

function storageKey(companyId: string): string {
  return `erp.dataEntryDraft.${companyId}`;
}

export default function DataEntryCenterPage() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const tr = (en: string, arText: string) => (ar ? arText : en);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id ?? "";
  const { data: projects } = useListProjects({ pageSize: 200 });
  const { data: unitStatuses } = useListUnitStatuses({ pageSize: 200 });

  const createProject = useCreateProject();
  const createPhase = useCreatePhase();
  const createBuilding = useCreateBuilding();
  const createFloor = useCreateFloor();
  const createUnit = useCreateUnit();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [loaded, setLoaded] = useState(false);

  const statusList = unitStatuses?.data ?? [];
  const defaultStatusId = useMemo(
    () => statusList.find((s) => s.code === "available")?.id ?? "",
    [statusList],
  );

  // Load persisted draft once the company is known.
  useEffect(() => {
    if (!companyId || loaded) return;
    try {
      const raw = localStorage.getItem(storageKey(companyId));
      if (raw) setDraft(JSON.parse(raw) as DraftState);
    } catch {
      /* ignore malformed draft */
    }
    setLoaded(true);
  }, [companyId, loaded]);

  // Persist draft on every change.
  useEffect(() => {
    if (!companyId || !loaded) return;
    try {
      localStorage.setItem(storageKey(companyId), JSON.stringify(draft));
    } catch {
      /* storage may be unavailable */
    }
  }, [draft, companyId, loaded]);

  const counts = countDraft(draft);

  const flatBuildings: FlatBuilding[] = useMemo(() => {
    const out: FlatBuilding[] = [];
    for (const phase of draft.phases) {
      for (const building of phase.buildings) out.push({ phase, building });
    }
    return out;
  }, [draft]);

  // ---- immutable nested updaters -----------------------------------------
  const setPhases = (phases: DraftPhase[]) => setDraft((d) => ({ ...d, phases }));

  const updatePhase = (phaseId: string, fn: (p: DraftPhase) => DraftPhase) =>
    setDraft((d) => ({
      ...d,
      phases: d.phases.map((p) => (p.id === phaseId ? fn(p) : p)),
    }));

  const updateBuilding = (
    phaseId: string,
    buildingId: string,
    fn: (b: DraftBuilding) => DraftBuilding,
  ) =>
    updatePhase(phaseId, (p) => ({
      ...p,
      buildings: p.buildings.map((b) => (b.id === buildingId ? fn(b) : b)),
    }));

  const updateFloor = (
    phaseId: string,
    buildingId: string,
    floorId: string,
    fn: (f: DraftFloor) => DraftFloor,
  ) =>
    updateBuilding(phaseId, buildingId, (b) => ({
      ...b,
      floors: b.floors.map((f) => (f.id === floorId ? fn(f) : f)),
    }));

  // ---- step gating --------------------------------------------------------
  const projectReady =
    draft.projectMode === "existing"
      ? !!draft.existingProjectId
      : !!(draft.projectCode.trim() && draft.projectName.trim() && draft.projectNameAr.trim());

  const canConfirm = projectReady && counts.units > 0 && !!companyId;

  // ---- commit -------------------------------------------------------------
  const [committing, setCommitting] = useState(false);
  const [committedUnits, setCommittedUnits] = useState(0);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function commit() {
    if (!companyId) return;
    setCommitting(true);
    setCommitError(null);
    setCommittedUnits(0);
    // Work on a mutable clone so already-created server ids are recorded as we
    // go. On a partial failure we persist this progress, so a retry resumes
    // instead of replaying creates that already succeeded (no duplicates).
    const working: DraftState = structuredClone(draft);
    let unitTally = 0;
    try {
      let projectId = working.committedProjectId || working.existingProjectId;
      if (working.projectMode === "create" && !working.committedProjectId) {
        const created = await createProject.mutateAsync({
          data: {
            companyId,
            code: working.projectCode.trim(),
            name: working.projectName.trim(),
            nameAr: working.projectNameAr.trim(),
            ...(working.projectLocation.trim() ? { location: working.projectLocation.trim() } : {}),
          },
        });
        projectId = created.id;
        working.committedProjectId = created.id;
      }

      for (const phase of working.phases) {
        if (!phase.serverId) {
          const ph = await createPhase.mutateAsync({
            data: { companyId, projectId, code: phase.code, name: phase.name, nameAr: phase.nameAr },
          });
          phase.serverId = ph.id;
        }
        for (const building of phase.buildings) {
          if (!building.serverId) {
            const bl = await createBuilding.mutateAsync({
              data: {
                companyId,
                projectId,
                phaseId: phase.serverId,
                code: building.code,
                name: building.name,
                nameAr: building.nameAr,
                floorsCount: building.floors.length,
              },
            });
            building.serverId = bl.id;
          }
          for (const floor of building.floors) {
            if (!floor.serverId) {
              const fl = await createFloor.mutateAsync({
                data: {
                  companyId,
                  projectId,
                  phaseId: phase.serverId,
                  buildingId: building.serverId,
                  code: `${building.code}-${floor.segment}`,
                  name: floor.name,
                  nameAr: floor.nameAr,
                  floorNumber: floor.floorNumber,
                },
              });
              floor.serverId = fl.id;
            }
            for (const unit of floor.units) {
              if (!unit.serverId) {
                const { total, discountAmount, net } = computePricing(unit);
                const bedrooms = Number.parseInt(unit.bedrooms, 10);
                const bathrooms = Number.parseInt(unit.bathrooms, 10);
                const num = (v: string) => {
                  const n = Number(v);
                  return v.trim() !== "" && Number.isFinite(n) ? n.toFixed(2) : undefined;
                };
                const created = await createUnit.mutateAsync({
                  data: {
                    companyId,
                    projectId,
                    phaseId: phase.serverId,
                    buildingId: building.serverId,
                    floorId: floor.serverId,
                    code: unit.fullCode,
                    name: unit.fullCode,
                    nameAr: unit.fullCode,
                    ...(unit.area.trim() ? { area: unit.area.trim() } : {}),
                    ...(Number.isFinite(bedrooms) ? { bedrooms } : {}),
                    ...(Number.isFinite(bathrooms) ? { bathrooms } : {}),
                    ...(net > 0 ? { basePrice: net.toFixed(2) } : {}),
                    ...(num(unit.pricePerMeter) ? { pricePerMeter: num(unit.pricePerMeter) } : {}),
                    ...(total > 0 ? { totalPrice: total.toFixed(2) } : {}),
                    ...(discountAmount > 0 ? { discount: discountAmount.toFixed(2) } : {}),
                    ...(num(unit.maxDiscount) ? { maxDiscount: num(unit.maxDiscount) } : {}),
                    ...(num(unit.minSellingPrice) ? { minSellingPrice: num(unit.minSellingPrice) } : {}),
                    ...(num(unit.commission) ? { commission: num(unit.commission) } : {}),
                    ...(num(unit.taxes) ? { taxes: num(unit.taxes) } : {}),
                    paymentOption: unit.paymentOption,
                    collectionMethod: unit.collectionMethod,
                    ...(unit.unitStatusId || defaultStatusId
                      ? { unitStatusId: unit.unitStatusId || defaultStatusId }
                      : {}),
                  },
                });
                unit.serverId = created.id;
              }
              unitTally += 1;
              setCommittedUnits(unitTally);
            }
          }
        }
      }

      await queryClient.invalidateQueries();
      try {
        localStorage.removeItem(storageKey(companyId));
      } catch {
        /* ignore */
      }
      setDone(true);
      toast({ title: tr("Project setup confirmed", "تم تأكيد إعداد المشروع") });
    } catch (e) {
      // Persist partial progress so the next Confirm resumes from here.
      setDraft(working);
      const msg = e instanceof Error ? e.message : String(e);
      setCommitError(msg);
      toast({
        title: tr("Setup failed", "فشل الإعداد"),
        description: tr(
          "Progress was saved. Press Confirm again to resume from where it stopped.",
          "تم حفظ التقدم. اضغط تأكيد مرة أخرى للمتابعة من حيث توقف.",
        ),
        variant: "destructive",
      });
    } finally {
      setCommitting(false);
    }
  }

  function resetWizard() {
    setDraft(emptyDraft());
    setStep(0);
    setDone(false);
    setCommitError(null);
    setCommittedUnits(0);
    if (companyId) {
      try {
        localStorage.removeItem(storageKey(companyId));
      } catch {
        /* ignore */
      }
    }
  }

  // ---- render -------------------------------------------------------------
  if (done) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-1">
        <Card>
          <CardHeader>
            <CardTitle>{tr("Project setup complete", "اكتمل إعداد المشروع")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {tr(
                "All master-data records were created in the existing modules.",
                "تم إنشاء جميع بيانات السجلات الرئيسية في الوحدات الحالية.",
              )}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryStat label={tr("Phases", "المراحل")} value={counts.phases} />
              <SummaryStat label={tr("Buildings", "المباني")} value={counts.buildings} />
              <SummaryStat label={tr("Floors", "الطوابق")} value={counts.floors} />
              <SummaryStat label={tr("Units", "الوحدات")} value={counts.units} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate("/units")}>{tr("View Units", "عرض الوحدات")}</Button>
              <Button variant="outline" onClick={() => navigate("/projects")}>
                {tr("View Projects", "عرض المشاريع")}
              </Button>
              <Button variant="ghost" onClick={resetWizard}>
                {tr("New Setup", "إعداد جديد")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title={tr("Data Entry Center", "مركز إدخال البيانات")}
          description={tr(
            "Guided bulk setup that writes directly into the existing master-data modules.",
            "إعداد مجمّع موجّه يكتب مباشرة في وحدات البيانات الرئيسية الحالية.",
          )}
          bordered={false}
        />
        <div className="text-sm text-muted-foreground">
          {tr("Draft saved automatically", "يتم حفظ المسودة تلقائياً")}
        </div>
      </div>

      <Stepper step={step} ar={ar} onStep={setStep} />

      <Card>
        <CardContent className="pt-6">
          {step === 0 && (
            <ProjectStep
              draft={draft}
              setDraft={setDraft}
              projects={(projects?.data ?? []).map((p) => ({ id: p.id, label: p.name, code: p.code }))}
              tr={tr}
            />
          )}
          {step === 1 && <PhasesStep draft={draft} setPhases={setPhases} tr={tr} />}
          {step === 2 && (
            <BuildingsStep
              draft={draft}
              updatePhase={updatePhase}
              language={language}
              tr={tr}
            />
          )}
          {step === 3 && (
            <FloorsStep
              flatBuildings={flatBuildings}
              updateBuilding={updateBuilding}
              language={language}
              tr={tr}
            />
          )}
          {step === 4 && (
            <UnitsStep
              flatBuildings={flatBuildings}
              updateBuilding={updateBuilding}
              language={language}
              tr={tr}
            />
          )}
          {step === 5 && (
            <PricingStep
              flatBuildings={flatBuildings}
              updateBuilding={updateBuilding}
              updateFloor={updateFloor}
              language={language}
              tr={tr}
            />
          )}
          {step === 6 && (
            <AvailabilityStep
              flatBuildings={flatBuildings}
              updateBuilding={updateBuilding}
              updateFloor={updateFloor}
              statusList={statusList.map((s) => ({ id: s.id, label: ar ? s.nameAr : s.name }))}
              defaultStatusId={defaultStatusId}
              language={language}
              tr={tr}
            />
          )}
          {step === 7 && (
            <ReviewStep
              draft={draft}
              counts={counts}
              committing={committing}
              committedUnits={committedUnits}
              commitError={commitError}
              canConfirm={canConfirm}
              projectReady={projectReady}
              hasUnits={counts.units > 0}
              hasCompany={!!companyId}
              onConfirm={commit}
              language={language}
              tr={tr}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={step === 0 || committing} onClick={() => setStep((s) => s - 1)}>
          {tr("Back", "السابق")}
        </Button>
        <div className="flex gap-2">
          {step < STEPS.length - 1 && (
            <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              {tr("Save & Continue", "حفظ ومتابعة")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3 text-center">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Stepper({
  step,
  ar,
  onStep,
}: {
  step: number;
  ar: boolean;
  onStep: (n: number) => void;
}) {
  const pct = ((step + 1) / STEPS.length) * 100;
  return (
    <div className="space-y-3">
      <Progress value={pct} />
      <div className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onStep(i)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              i === step
                ? "bg-primary text-primary-foreground"
                : i < step
                  ? "bg-primary/15 text-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}. {ar ? s.ar : s.en}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

type Tr = (en: string, ar: string) => string;

function ProjectStep({
  draft,
  setDraft,
  projects,
  tr,
}: {
  draft: DraftState;
  setDraft: React.Dispatch<React.SetStateAction<DraftState>>;
  projects: { id: string; label: string; code: string }[];
  tr: Tr;
}) {
  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <Button
          variant={draft.projectMode === "create" ? "default" : "outline"}
          size="sm"
          onClick={() => setDraft((d) => ({ ...d, projectMode: "create" }))}
        >
          {tr("Create New Project", "إنشاء مشروع جديد")}
        </Button>
        <Button
          variant={draft.projectMode === "existing" ? "default" : "outline"}
          size="sm"
          onClick={() => setDraft((d) => ({ ...d, projectMode: "existing" }))}
        >
          {tr("Use Existing Project", "استخدام مشروع قائم")}
        </Button>
      </div>

      {draft.projectMode === "create" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("Project Code", "رمز المشروع")}>
            <Input
              value={draft.projectCode}
              onChange={(e) => setDraft((d) => ({ ...d, projectCode: e.target.value }))}
              placeholder="PRJ-001"
            />
          </Field>
          <Field label={tr("Location", "الموقع")}>
            <Input
              value={draft.projectLocation}
              onChange={(e) => setDraft((d) => ({ ...d, projectLocation: e.target.value }))}
            />
          </Field>
          <Field label={tr("Name (English)", "الاسم (إنجليزي)")}>
            <Input
              value={draft.projectName}
              onChange={(e) => setDraft((d) => ({ ...d, projectName: e.target.value }))}
            />
          </Field>
          <Field label={tr("Name (Arabic)", "الاسم (عربي)")}>
            <Input
              value={draft.projectNameAr}
              onChange={(e) => setDraft((d) => ({ ...d, projectNameAr: e.target.value }))}
            />
          </Field>
        </div>
      ) : (
        <Field label={tr("Select Project", "اختر المشروع")}>
          <Select
            value={draft.existingProjectId}
            onValueChange={(v) => setDraft((d) => ({ ...d, existingProjectId: v }))}
          >
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder={tr("Choose a project", "اختر مشروعاً")} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label} ({p.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <p className="text-sm text-muted-foreground">
        {tr(
          "Phases, buildings, floors and units you add next will be created under this project.",
          "سيتم إنشاء المراحل والمباني والطوابق والوحدات التالية ضمن هذا المشروع.",
        )}
      </p>
    </div>
  );
}

function PhasesStep({
  draft,
  setPhases,
  tr,
}: {
  draft: DraftState;
  setPhases: (p: DraftPhase[]) => void;
  tr: Tr;
}) {
  const [count, setCount] = useState(String(Math.max(1, draft.phases.length || 1)));

  const generate = () => {
    const n = Math.max(0, Math.min(50, Number(count) || 0));
    const base = draft.projectCode.trim() || "PRJ";
    const phases: DraftPhase[] = Array.from({ length: n }, (_, i) => {
      const existing = draft.phases[i];
      return (
        existing ?? {
          id: uid(),
          code: `${base}-P${i + 1}`,
          name: `Phase ${i + 1}`,
          nameAr: `المرحلة ${i + 1}`,
          buildings: [],
        }
      );
    });
    setPhases(phases);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={tr("Number of Phases", "عدد المراحل")}>
          <Input
            type="number"
            min={0}
            className="w-32"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </Field>
        <Button onClick={generate}>{tr("Generate Phases", "توليد المراحل")}</Button>
      </div>

      <div className="space-y-3">
        {draft.phases.map((p, i) => (
          <div key={p.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
            <Field label={`${tr("Code", "الرمز")} #${i + 1}`}>
              <Input
                value={p.code}
                onChange={(e) =>
                  setPhases(draft.phases.map((x) => (x.id === p.id ? { ...x, code: e.target.value } : x)))
                }
              />
            </Field>
            <Field label={tr("Name (English)", "الاسم (إنجليزي)")}>
              <Input
                value={p.name}
                onChange={(e) =>
                  setPhases(draft.phases.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))
                }
              />
            </Field>
            <Field label={tr("Name (Arabic)", "الاسم (عربي)")}>
              <Input
                value={p.nameAr}
                onChange={(e) =>
                  setPhases(draft.phases.map((x) => (x.id === p.id ? { ...x, nameAr: e.target.value } : x)))
                }
              />
            </Field>
          </div>
        ))}
        {draft.phases.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {tr("No phases yet. Set a count and generate.", "لا توجد مراحل بعد. حدد العدد ثم ولّد.")}
          </p>
        )}
      </div>
    </div>
  );
}

function BuildingsStep({
  draft,
  updatePhase,
  language,
  tr,
}: {
  draft: DraftState;
  updatePhase: (phaseId: string, fn: (p: DraftPhase) => DraftPhase) => void;
  language: "en" | "ar";
  tr: Tr;
}) {
  const [phaseId, setPhaseId] = useState(draft.phases[0]?.id ?? "");
  const [type, setType] = useState(BUILDING_TYPES[0].value);
  const [qty, setQty] = useState("1");

  const activePhase = draft.phases.find((p) => p.id === phaseId) ?? draft.phases[0];

  const addBuildings = () => {
    if (!activePhase) return;
    const n = Math.max(1, Math.min(100, Number(qty) || 1));
    const prefix = buildingTypeCode(type);
    updatePhase(activePhase.id, (p) => {
      const startIndex = p.buildings.length + 1;
      const newOnes: DraftBuilding[] = Array.from({ length: n }, (_, i) => {
        const code = `${prefix}${startIndex + i}`;
        const label = buildingTypeLabel(type, language);
        return {
          id: uid(),
          type,
          code,
          name: `${label} ${code}`,
          nameAr: `${buildingTypeLabel(type, "ar")} ${code}`,
          floors: [],
        };
      });
      return { ...p, buildings: [...p.buildings, ...newOnes] };
    });
  };

  if (draft.phases.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {tr("Add phases first.", "أضف المراحل أولاً.")}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={tr("Phase", "المرحلة")}>
          <Select value={activePhase?.id} onValueChange={setPhaseId}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {draft.phases.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={tr("Building Type", "نوع المبنى")}>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUILDING_TYPES.map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {language === "ar" ? b.ar : b.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={tr("Quantity", "الكمية")}>
          <Input type="number" min={1} className="w-24" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Button onClick={addBuildings}>{tr("Add Buildings", "إضافة مباني")}</Button>
      </div>

      <div className="space-y-4">
        {draft.phases.map((p) => (
          <div key={p.id} className="space-y-2">
            <div className="text-sm font-medium">{p.name}</div>
            {p.buildings.length === 0 ? (
              <p className="text-xs text-muted-foreground">{tr("No buildings.", "لا توجد مباني.")}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {p.buildings.map((b) => (
                  <div key={b.id} className="flex items-center gap-2 rounded-md border p-2">
                    <Input
                      className="w-24"
                      value={b.code}
                      onChange={(e) =>
                        updatePhase(p.id, (ph) => ({
                          ...ph,
                          buildings: ph.buildings.map((x) =>
                            x.id === b.id ? reindexBuilding({ ...x, code: e.target.value }) : x,
                          ),
                        }))
                      }
                    />
                    <Input
                      className="flex-1"
                      value={b.name}
                      onChange={(e) =>
                        updatePhase(p.id, (ph) => ({
                          ...ph,
                          buildings: ph.buildings.map((x) =>
                            x.id === b.id ? { ...x, name: e.target.value } : x,
                          ),
                        }))
                      }
                    />
                    <Badge variant="secondary">{buildingTypeLabel(b.type, language)}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updatePhase(p.id, (ph) => ({
                          ...ph,
                          buildings: ph.buildings.filter((x) => x.id !== b.id),
                        }))
                      }
                    >
                      {tr("Remove", "حذف")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BuildingPicker({
  flatBuildings,
  value,
  onChange,
  language,
}: {
  flatBuildings: FlatBuilding[];
  value: string;
  onChange: (v: string) => void;
  language: "en" | "ar";
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-72">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {flatBuildings.map(({ phase, building }) => (
          <SelectItem key={building.id} value={building.id}>
            {phase.name} / {building.code} — {buildingTypeLabel(building.type, language)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FloorsStep({
  flatBuildings,
  updateBuilding,
  language,
  tr,
}: {
  flatBuildings: FlatBuilding[];
  updateBuilding: (phaseId: string, buildingId: string, fn: (b: DraftBuilding) => DraftBuilding) => void;
  language: "en" | "ar";
  tr: Tr;
}) {
  const [buildingId, setBuildingId] = useState(flatBuildings[0]?.building.id ?? "");
  const [spec, setSpec] = useState<FloorSpec>(defaultFloorSpec);

  const active = flatBuildings.find((f) => f.building.id === buildingId) ?? flatBuildings[0];

  const generate = () => {
    if (!active) return;
    const descriptors = buildFloorDescriptors(spec);
    updateBuilding(active.phase.id, active.building.id, (b) => ({
      ...b,
      floors: descriptors.map((d) => ({
        id: uid(),
        segment: d.segment,
        name: d.name,
        nameAr: d.nameAr,
        floorNumber: d.floorNumber,
        units: [],
      })),
    }));
  };

  if (flatBuildings.length === 0) {
    return <p className="text-sm text-muted-foreground">{tr("Add buildings first.", "أضف المباني أولاً.")}</p>;
  }

  const numField = (k: keyof FloorSpec, label: string) => (
    <Field label={label}>
      <Input
        type="number"
        min={0}
        className="w-24"
        value={String(spec[k] as number)}
        onChange={(e) => setSpec((s) => ({ ...s, [k]: Math.max(0, Number(e.target.value) || 0) }))}
      />
    </Field>
  );

  const boolField = (k: keyof FloorSpec, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={spec[k] as boolean}
        onChange={(e) => setSpec((s) => ({ ...s, [k]: e.target.checked }))}
      />
      {label}
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={tr("Building", "المبنى")}>
          <BuildingPicker
            flatBuildings={flatBuildings}
            value={active?.building.id ?? ""}
            onChange={setBuildingId}
            language={language}
          />
        </Field>
        {numField("basements", tr("Basements", "بدرومات"))}
        {numField("typicalFloors", tr("Typical Floors", "الطوابق المتكررة"))}
      </div>
      <div className="flex flex-wrap gap-4">
        {boolField("ground", tr("Ground", "أرضي"))}
        {boolField("groundGarden", tr("Ground + Garden", "أرضي بحديقة"))}
        {boolField("mezzanine", tr("Mezzanine", "ميزانين"))}
        {boolField("penthouse", tr("Penthouse", "بنتهاوس"))}
        {boolField("roof", tr("Roof", "السطح"))}
      </div>
      <Button onClick={generate}>{tr("Generate Floors", "توليد الطوابق")}</Button>

      {active && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            {active.phase.name} / {active.building.code}
          </div>
          {active.building.floors.length === 0 ? (
            <p className="text-xs text-muted-foreground">{tr("No floors yet.", "لا توجد طوابق بعد.")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {active.building.floors.map((f) => (
                <Badge key={f.id} variant="outline">
                  {language === "ar" ? f.nameAr : f.name} ({f.segment})
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UnitsStep({
  flatBuildings,
  updateBuilding,
  language,
  tr,
}: {
  flatBuildings: FlatBuilding[];
  updateBuilding: (phaseId: string, buildingId: string, fn: (b: DraftBuilding) => DraftBuilding) => void;
  language: "en" | "ar";
  tr: Tr;
}) {
  const [buildingId, setBuildingId] = useState(flatBuildings[0]?.building.id ?? "");
  const [perFloor, setPerFloor] = useState("4");

  const active = flatBuildings.find((f) => f.building.id === buildingId) ?? flatBuildings[0];

  const generate = () => {
    if (!active) return;
    const n = Math.max(0, Math.min(200, Number(perFloor) || 0));
    updateBuilding(active.phase.id, active.building.id, (b) => ({
      ...b,
      floors: b.floors.map((f) => ({
        ...f,
        units: Array.from({ length: n }, (_, i) => makeUnit(b.code, f.segment, i + 1)),
      })),
    }));
  };

  if (flatBuildings.length === 0) {
    return <p className="text-sm text-muted-foreground">{tr("Add buildings first.", "أضف المباني أولاً.")}</p>;
  }
  const hasFloors = (active?.building.floors.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={tr("Building", "المبنى")}>
          <BuildingPicker
            flatBuildings={flatBuildings}
            value={active?.building.id ?? ""}
            onChange={setBuildingId}
            language={language}
          />
        </Field>
        <Field label={tr("Units per Floor", "وحدات لكل طابق")}>
          <Input type="number" min={0} className="w-28" value={perFloor} onChange={(e) => setPerFloor(e.target.value)} />
        </Field>
        <Button onClick={generate} disabled={!hasFloors}>
          {tr("Generate Units", "توليد الوحدات")}
        </Button>
      </div>
      {!hasFloors && (
        <p className="text-xs text-muted-foreground">
          {tr("This building has no floors yet.", "هذا المبنى لا يحتوي على طوابق بعد.")}
        </p>
      )}

      {active &&
        active.building.floors.map((f) => (
          <div key={f.id} className="space-y-2">
            <div className="text-sm font-medium">
              {f.name} — {f.units.length} {tr("units", "وحدة")}
            </div>
            {f.units.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr("Full Code", "الرمز الكامل")}</TableHead>
                    <TableHead>{tr("Area (m²)", "المساحة (م²)")}</TableHead>
                    <TableHead>{tr("Bedrooms", "غرف النوم")}</TableHead>
                    <TableHead>{tr("Bathrooms", "الحمامات")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {f.units.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.fullCode}</TableCell>
                      <TableCell>
                        <Input
                          className="w-24"
                          value={u.area}
                          onChange={(e) =>
                            updateBuilding(active.phase.id, active.building.id, (b) => ({
                              ...b,
                              floors: b.floors.map((fl) =>
                                fl.id === f.id
                                  ? {
                                      ...fl,
                                      units: fl.units.map((x) =>
                                        x.id === u.id ? { ...x, area: e.target.value } : x,
                                      ),
                                    }
                                  : fl,
                              ),
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-20"
                          value={u.bedrooms}
                          onChange={(e) =>
                            updateBuilding(active.phase.id, active.building.id, (b) => ({
                              ...b,
                              floors: b.floors.map((fl) =>
                                fl.id === f.id
                                  ? {
                                      ...fl,
                                      units: fl.units.map((x) =>
                                        x.id === u.id ? { ...x, bedrooms: e.target.value } : x,
                                      ),
                                    }
                                  : fl,
                              ),
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-20"
                          value={u.bathrooms}
                          onChange={(e) =>
                            updateBuilding(active.phase.id, active.building.id, (b) => ({
                              ...b,
                              floors: b.floors.map((fl) =>
                                fl.id === f.id
                                  ? {
                                      ...fl,
                                      units: fl.units.map((x) =>
                                        x.id === u.id ? { ...x, bathrooms: e.target.value } : x,
                                      ),
                                    }
                                  : fl,
                              ),
                            }))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        ))}
    </div>
  );
}

function PricingStep({
  flatBuildings,
  updateBuilding,
  updateFloor,
  language,
  tr,
}: {
  flatBuildings: FlatBuilding[];
  updateBuilding: (phaseId: string, buildingId: string, fn: (b: DraftBuilding) => DraftBuilding) => void;
  updateFloor: (
    phaseId: string,
    buildingId: string,
    floorId: string,
    fn: (f: DraftFloor) => DraftFloor,
  ) => void;
  language: "en" | "ar";
  tr: Tr;
}) {
  const [buildingId, setBuildingId] = useState(flatBuildings[0]?.building.id ?? "");
  const [pm, setPm] = useState("");
  const [disc, setDisc] = useState("");
  const [discType, setDiscType] = useState<DiscountType>("amount");
  const [charges, setCharges] = useState("");
  const [maxDisc, setMaxDisc] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [commission, setCommission] = useState("");
  const [taxes, setTaxes] = useState("");
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("cash");
  const [collectionMethod, setCollectionMethod] = useState<CollectionMethod>("cash");

  const active = flatBuildings.find((f) => f.building.id === buildingId) ?? flatBuildings[0];

  const applyToBuilding = () => {
    if (!active) return;
    updateBuilding(active.phase.id, active.building.id, (b) => ({
      ...b,
      floors: b.floors.map((fl) => ({
        ...fl,
        units: fl.units.map((u) => ({
          ...u,
          pricePerMeter: pm,
          discount: disc,
          discountType: discType,
          additionalCharges: charges,
          maxDiscount: maxDisc,
          minSellingPrice: minPrice,
          commission,
          taxes,
          paymentOption,
          collectionMethod,
        })),
      })),
    }));
  };

  if (flatBuildings.length === 0) {
    return <p className="text-sm text-muted-foreground">{tr("Add units first.", "أضف الوحدات أولاً.")}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={tr("Building", "المبنى")}>
          <BuildingPicker
            flatBuildings={flatBuildings}
            value={active?.building.id ?? ""}
            onChange={setBuildingId}
            language={language}
          />
        </Field>
        <Field label={tr("Price / m²", "السعر / م²")}>
          <Input type="number" className="w-28" value={pm} onChange={(e) => setPm(e.target.value)} />
        </Field>
        <Field label={tr("Discount", "الخصم")}>
          <Input type="number" className="w-24" value={disc} onChange={(e) => setDisc(e.target.value)} />
        </Field>
        <Field label={tr("Discount Type", "نوع الخصم")}>
          <Select value={discType} onValueChange={(v) => setDiscType(v as DiscountType)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="amount">{tr("Amount", "مبلغ")}</SelectItem>
              <SelectItem value="percent">{tr("Percent", "نسبة %")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={tr("Extra Charges", "رسوم إضافية")}>
          <Input type="number" className="w-28" value={charges} onChange={(e) => setCharges(e.target.value)} />
        </Field>
        <Field label={tr("Max Discount", "أقصى خصم")}>
          <Input type="number" className="w-24" value={maxDisc} onChange={(e) => setMaxDisc(e.target.value)} />
        </Field>
        <Field label={tr("Min Selling Price", "أدنى سعر بيع")}>
          <Input type="number" className="w-28" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
        </Field>
        <Field label={tr("Commission", "العمولة")}>
          <Input type="number" className="w-24" value={commission} onChange={(e) => setCommission(e.target.value)} />
        </Field>
        <Field label={tr("Taxes", "الضرائب")}>
          <Input type="number" className="w-24" value={taxes} onChange={(e) => setTaxes(e.target.value)} />
        </Field>
        <Field label={tr("Payment Option", "خيار الدفع")}>
          <Select value={paymentOption} onValueChange={(v) => setPaymentOption(v as PaymentOption)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">{tr("Cash", "نقدي")}</SelectItem>
              <SelectItem value="installments">{tr("Installments", "أقساط")}</SelectItem>
              <SelectItem value="mixed">{tr("Mixed", "مختلط")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={tr("Collection Method", "طريقة التحصيل")}>
          <Select value={collectionMethod} onValueChange={(v) => setCollectionMethod(v as CollectionMethod)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">{tr("Cash", "نقدي")}</SelectItem>
              <SelectItem value="bank_transfer">{tr("Bank Transfer", "تحويل بنكي")}</SelectItem>
              <SelectItem value="cheque">{tr("Cheque", "شيك")}</SelectItem>
              <SelectItem value="mixed">{tr("Mixed", "مختلط")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Button onClick={applyToBuilding}>{tr("Apply to Building", "تطبيق على المبنى")}</Button>
      </div>

      {active &&
        active.building.floors.map((f) => (
          <div key={f.id} className="space-y-2">
            <div className="text-sm font-medium">{f.name}</div>
            {f.units.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr("Full Code", "الرمز الكامل")}</TableHead>
                    <TableHead>{tr("Area", "المساحة")}</TableHead>
                    <TableHead>{tr("Price / m²", "السعر / م²")}</TableHead>
                    <TableHead>{tr("Discount", "الخصم")}</TableHead>
                    <TableHead>{tr("Extra", "إضافي")}</TableHead>
                    <TableHead>{tr("Max Disc.", "أقصى خصم")}</TableHead>
                    <TableHead>{tr("Min Price", "أدنى سعر")}</TableHead>
                    <TableHead>{tr("Commission", "العمولة")}</TableHead>
                    <TableHead>{tr("Taxes", "الضرائب")}</TableHead>
                    <TableHead>{tr("Total", "الإجمالي")}</TableHead>
                    <TableHead>{tr("Net", "الصافي")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {f.units.map((u) => {
                    const { total, net } = computePricing(u);
                    const setU = (patch: Partial<typeof u>) =>
                      updateFloor(active.phase.id, active.building.id, f.id, (fl) => ({
                        ...fl,
                        units: fl.units.map((x) => (x.id === u.id ? { ...x, ...patch } : x)),
                      }));
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.fullCode}</TableCell>
                        <TableCell>{u.area || "-"}</TableCell>
                        <TableCell>
                          <Input
                            className="w-24"
                            value={u.pricePerMeter}
                            onChange={(e) => setU({ pricePerMeter: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="w-20"
                            value={u.discount}
                            onChange={(e) => setU({ discount: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="w-24"
                            value={u.additionalCharges}
                            onChange={(e) => setU({ additionalCharges: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="w-20"
                            value={u.maxDiscount}
                            onChange={(e) => setU({ maxDiscount: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="w-24"
                            value={u.minSellingPrice}
                            onChange={(e) => setU({ minSellingPrice: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="w-20"
                            value={u.commission}
                            onChange={(e) => setU({ commission: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="w-20"
                            value={u.taxes}
                            onChange={(e) => setU({ taxes: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>{money(total, language)}</TableCell>
                        <TableCell className="font-medium">{money(net, language)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        ))}
    </div>
  );
}

function AvailabilityStep({
  flatBuildings,
  updateBuilding,
  updateFloor,
  statusList,
  defaultStatusId,
  language,
  tr,
}: {
  flatBuildings: FlatBuilding[];
  updateBuilding: (phaseId: string, buildingId: string, fn: (b: DraftBuilding) => DraftBuilding) => void;
  updateFloor: (
    phaseId: string,
    buildingId: string,
    floorId: string,
    fn: (f: DraftFloor) => DraftFloor,
  ) => void;
  statusList: { id: string; label: string }[];
  defaultStatusId: string;
  language: "en" | "ar";
  tr: Tr;
}) {
  const [buildingId, setBuildingId] = useState(flatBuildings[0]?.building.id ?? "");
  const [bulkStatus, setBulkStatus] = useState(defaultStatusId);

  const active = flatBuildings.find((f) => f.building.id === buildingId) ?? flatBuildings[0];

  const applyToBuilding = () => {
    if (!active) return;
    updateBuilding(active.phase.id, active.building.id, (b) => ({
      ...b,
      floors: b.floors.map((fl) => ({
        ...fl,
        units: fl.units.map((u) => ({ ...u, unitStatusId: bulkStatus })),
      })),
    }));
  };

  if (flatBuildings.length === 0) {
    return <p className="text-sm text-muted-foreground">{tr("Add units first.", "أضف الوحدات أولاً.")}</p>;
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {tr(
          "Set each unit's status. This writes the existing unit status only — sales, reservations and contracts stay in the Sales module.",
          "حدد حالة كل وحدة. يكتب هذا حالة الوحدة الحالية فقط — تبقى المبيعات والحجوزات والعقود في وحدة المبيعات.",
        )}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={tr("Building", "المبنى")}>
          <BuildingPicker
            flatBuildings={flatBuildings}
            value={active?.building.id ?? ""}
            onChange={setBuildingId}
            language={language}
          />
        </Field>
        <Field label={tr("Status", "الحالة")}>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={tr("Select", "اختر")} />
            </SelectTrigger>
            <SelectContent>
              {statusList.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button onClick={applyToBuilding}>{tr("Apply to Building", "تطبيق على المبنى")}</Button>
      </div>

      {active &&
        active.building.floors.map((f) => (
          <div key={f.id} className="space-y-2">
            <div className="text-sm font-medium">{f.name}</div>
            {f.units.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {f.units.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 rounded-md border p-2">
                    <span className="flex-1 text-sm font-medium">{u.fullCode}</span>
                    <Select
                      value={u.unitStatusId || defaultStatusId}
                      onValueChange={(v) =>
                        updateFloor(active.phase.id, active.building.id, f.id, (fl) => ({
                          ...fl,
                          units: fl.units.map((x) => (x.id === u.id ? { ...x, unitStatusId: v } : x)),
                        }))
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder={tr("Select", "اختر")} />
                      </SelectTrigger>
                      <SelectContent>
                        {statusList.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

function ReviewStep({
  draft,
  counts,
  committing,
  committedUnits,
  commitError,
  canConfirm,
  projectReady,
  hasUnits,
  hasCompany,
  onConfirm,
  language,
  tr,
}: {
  draft: DraftState;
  counts: { phases: number; buildings: number; floors: number; units: number };
  committing: boolean;
  committedUnits: number;
  commitError: string | null;
  canConfirm: boolean;
  projectReady: boolean;
  hasUnits: boolean;
  hasCompany: boolean;
  onConfirm: () => void;
  language: "en" | "ar";
  tr: Tr;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label={tr("Phases", "المراحل")} value={counts.phases} />
        <SummaryStat label={tr("Buildings", "المباني")} value={counts.buildings} />
        <SummaryStat label={tr("Floors", "الطوابق")} value={counts.floors} />
        <SummaryStat label={tr("Units", "الوحدات")} value={counts.units} />
      </div>

      <div className="rounded-md border">
        <div className="border-b p-3 text-sm font-medium">
          {tr("Project", "المشروع")}:{" "}
          {draft.projectMode === "create"
            ? `${draft.projectName} (${draft.projectCode})`
            : tr("Existing project", "مشروع قائم")}
        </div>
        <div className="max-h-72 space-y-3 overflow-auto p-3 text-sm">
          {draft.phases.map((p) => (
            <div key={p.id}>
              <div className="font-medium">{p.name}</div>
              <ul className="ms-4 list-disc text-muted-foreground">
                {p.buildings.map((b) => (
                  <li key={b.id}>
                    {b.code} — {buildingTypeLabel(b.type, language)} · {b.floors.length}{" "}
                    {tr("floors", "طابق")} ·{" "}
                    {b.floors.reduce((acc, f) => acc + f.units.length, 0)} {tr("units", "وحدة")}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {commitError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {commitError}
        </div>
      )}

      {committing && (
        <div className="space-y-2">
          <Progress value={counts.units ? (committedUnits / counts.units) * 100 : 0} />
          <p className="text-xs text-muted-foreground">
            {tr("Created", "تم إنشاء")} {committedUnits}/{counts.units} {tr("units", "وحدة")}
          </p>
        </div>
      )}

      <Separator />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {canConfirm ? (
          <p className="text-sm text-muted-foreground">
            {tr(
              "Confirm to create all records in the existing modules.",
              "أكّد لإنشاء جميع السجلات في الوحدات الحالية.",
            )}
          </p>
        ) : (
          <div className="space-y-1 text-sm">
            <p className="font-medium text-muted-foreground">
              {tr("Complete the following to confirm:", "أكمل ما يلي للتأكيد:")}
            </p>
            <ul className="space-y-0.5">
              <li className={projectReady ? "text-muted-foreground" : "text-destructive"}>
                {projectReady ? "✓" : "•"}{" "}
                {tr("Choose or create a project", "اختر أو أنشئ مشروعاً")}
              </li>
              <li className={hasUnits ? "text-muted-foreground" : "text-destructive"}>
                {hasUnits ? "✓" : "•"}{" "}
                {tr("Add at least one unit", "أضف وحدة واحدة على الأقل")}
              </li>
              {!hasCompany && (
                <li className="text-destructive">
                  •{" "}
                  {tr(
                    "No company is available for this session — reload the page or re-enter Testing Mode.",
                    "لا توجد شركة متاحة لهذه الجلسة — أعد تحميل الصفحة أو ادخل وضع الاختبار من جديد.",
                  )}
                </li>
              )}
            </ul>
          </div>
        )}
        <Button disabled={!canConfirm || committing} onClick={onConfirm}>
          {committing ? tr("Creating…", "جارٍ الإنشاء…") : tr("Confirm Project Setup", "تأكيد إعداد المشروع")}
        </Button>
      </div>
    </div>
  );
}
