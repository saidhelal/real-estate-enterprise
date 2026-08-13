import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Toolbar,
  ToolbarStart,
  ToolbarEnd,
  ToolbarSeparator,
  SelectionBar,
} from "@/components/ui/toolbar";
import { KpiCard } from "@/components/ui/kpi-card";
import { EmptyState, LoadingState, ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CHART_SERIES, ACCENT_CLASSES } from "@/lib/design-tokens";

/**
 * Living style guide.
 *
 * Renders the foundation against the real theme rather than documenting it in a
 * separate file that goes stale. It is how you check that a token change landed
 * everywhere, and how the two themes get compared without clicking through 300
 * screens. Read-only: it calls no API and mutates nothing.
 */

/* -- Local helpers. Deliberately not exported: these exist to lay out the
   guide itself and are not part of the design system. --------------------- */

function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <div>
        <h2 className="text-section-title">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Swatch({ token, label }: { token: string; label: string }) {
  return (
    <div className="space-y-1">
      <div
        className="h-12 rounded-md border border-border"
        style={{ backgroundColor: `hsl(var(--${token}))` }}
      />
      <div className="space-y-0.5">
        <p className="text-2xs font-medium">{label}</p>
        <code className="text-2xs text-muted-foreground">--{token}</code>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      <span className="w-28 shrink-0 text-2xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

const BRAND_RAMP = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

const TYPE_ROLES: Array<{ cls: string; name: string; usage: string }> = [
  { cls: "text-page-title", name: "Page title", usage: "21px / 600 — one per screen" },
  { cls: "text-section-title", name: "Section title", usage: "16px / 600" },
  { cls: "text-card-title", name: "Card title", usage: "14px / 600" },
  { cls: "text-base", name: "Body", usage: "14px / 400" },
  { cls: "text-sm", name: "Dense body", usage: "12px / 400 — tables, controls" },
  { cls: "text-label", name: "Label", usage: "11px / 500 — field labels" },
  { cls: "text-eyebrow", name: "Eyebrow", usage: "10px / 600 caps" },
];

const SPACING_STEPS = [1, 2, 3, 4, 6, 8, 12, 16];
const RADIUS_STEPS = ["xs", "sm", "md", "lg", "xl", "2xl"];
const ELEVATION_STEPS = [1, 2, 3, 4, 5];

export default function DesignSystemPage() {
  const [selected, setSelected] = useState(0);

  return (
    <div className="mx-auto w-full max-w-[var(--layout-content-max)] space-y-8 p-4">
      <PageHeader
        title="Design System"
        description="The foundation every screen is built from — tokens, type, spacing, elevation and the shared shell components."
        meta={<Badge variant="secondary">Foundation</Badge>}
        actions={
          <>
            <Button variant="outline" size="sm">
              Secondary
            </Button>
            <Button size="sm">Primary action</Button>
          </>
        }
      />

      <Section
        id="color"
        title="Colour"
        hint="Every colour in the app resolves to one of these tokens. Nothing hard-codes a hex or a palette class."
      >
        <div className="space-y-4">
          <div>
            <p className="text-eyebrow mb-2">Brand ramp</p>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {BRAND_RAMP.map((step) => (
                <Swatch key={step} token={`brand-${step}`} label={String(step)} />
              ))}
            </div>
          </div>

          <div>
            <p className="text-eyebrow mb-2">Surfaces &amp; chrome</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              <Swatch token="background" label="Background" />
              <Swatch token="surface" label="Surface" />
              <Swatch token="surface-sunken" label="Sunken" />
              <Swatch token="surface-raised" label="Raised" />
              <Swatch token="border" label="Border" />
              <Swatch token="border-strong" label="Border strong" />
            </div>
          </div>

          <div>
            <p className="text-eyebrow mb-2">Status</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              <Swatch token="primary" label="Primary" />
              <Swatch token="success" label="Success" />
              <Swatch token="warning" label="Warning" />
              <Swatch token="destructive" label="Error" />
              <Swatch token="info" label="Info" />
            </div>
          </div>

          <div>
            <p className="text-eyebrow mb-2">Chart series</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {CHART_SERIES.map((token, i) => (
                <Swatch key={token} token={token} label={`Series ${i + 1}`} />
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Separator />

      <Section
        id="type"
        title="Typography"
        hint="Root is 14px. Roles are named so a screen asks for a page title rather than re-deriving a size and weight."
      >
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {TYPE_ROLES.map((role) => (
              <div
                key={role.name}
                className="flex flex-wrap items-baseline justify-between gap-2 p-3"
              >
                <span className={role.cls}>{role.name} — العنوان بالعربية</span>
                <code className="text-2xs text-muted-foreground">{role.usage}</code>
              </div>
            ))}
          </CardContent>
        </Card>
      </Section>

      <Separator />

      <Section
        id="spacing"
        title="Spacing, radius &amp; elevation"
        hint="A 0.25rem step at a 14px root. Radii are tight because dense tables read sharper with small corners."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-card-title">Spacing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {SPACING_STEPS.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <code className="w-8 text-2xs text-muted-foreground">{s}</code>
                  <div
                    className="h-3 rounded-xs bg-primary/70"
                    style={{ width: `calc(var(--spacing) * ${s})` }}
                  />
                  <span className="text-2xs text-muted-foreground">
                    {(s * 0.25).toFixed(2)}rem
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-card-title">Radius</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              {RADIUS_STEPS.map((r) => (
                <div key={r} className="space-y-1 text-center">
                  <div
                    className="mx-auto h-12 w-full border border-border bg-surface-sunken"
                    style={{ borderRadius: `var(--radius-${r})` }}
                  />
                  <code className="text-2xs text-muted-foreground">{r}</code>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-card-title">Elevation</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              {ELEVATION_STEPS.map((e) => (
                <div key={e} className="space-y-1 text-center">
                  <div
                    className={`mx-auto h-12 w-full rounded-lg bg-surface elevation-${e}`}
                  />
                  <code className="text-2xs text-muted-foreground">{e}</code>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </Section>

      <Separator />

      <Section
        id="controls"
        title="Controls"
        hint="Hover and press feedback comes from the shared elevate utilities, so every variant behaves identically."
      >
        <Card>
          <CardContent className="divide-y divide-border p-3">
            <Row label="Variants">
              <Button size="sm">Primary</Button>
              <Button size="sm" variant="secondary">
                Secondary
              </Button>
              <Button size="sm" variant="outline">
                Outline
              </Button>
              <Button size="sm" variant="ghost">
                Ghost
              </Button>
              <Button size="sm" variant="destructive">
                Delete
              </Button>
              <Button size="sm" variant="success">
                Approve
              </Button>
              <Button size="sm" variant="warning">
                Hold
              </Button>
              <Button size="sm" variant="info">
                Details
              </Button>
            </Row>
            <Row label="Sizes">
              <Button size="sm">Small</Button>
              <Button>Default</Button>
              <Button size="lg">Large</Button>
              <Button disabled>Disabled</Button>
            </Row>
            <Row label="Badges">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Overdue</Badge>
            </Row>
            <Row label="Status">
              <StatusBadge tone="success" label="مُرحَّل / Posted" withDot />
              <StatusBadge tone="warning" label="معلّق / Pending" withDot />
              <StatusBadge tone="error" label="متأخر / Overdue" withDot />
              <StatusBadge tone="info" label="قيد التحصيل" withDot />
              <StatusBadge tone="neutral" label="مسودة / Draft" />
              <StatusBadge tone="success" variant="solid" label="Active" />
            </Row>
            <Row label="Input">
              <Input placeholder="بحث…" className="w-56" />
              <Input placeholder="Disabled" className="w-40" disabled />
            </Row>
          </CardContent>
        </Card>
      </Section>

      <Separator />

      <Section
        id="kpi"
        title="KPI tiles"
        hint="One implementation behind every metric on every dashboard. Trend polarity is declared by the caller, because a rise is not always good news."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="الوحدات المتاحة"
            value="10"
            tone="brand"
            trend={{ direction: "up", label: "8.2%+" }}
            hint="مقارنة بالشهر الماضي"
          />
          <KpiCard
            label="العقود الموقعة"
            value="5"
            tone="success"
            trend={{ direction: "up", label: "12%+" }}
          />
          <KpiCard
            label="أقساط متأخرة"
            value="3"
            tone="error"
            trend={{ direction: "up", label: "4%+", polarity: "positive-down" }}
            hint="ارتفاع غير مرغوب"
          />
          <KpiCard label="قيد التحميل" isLoading />
        </div>
      </Section>

      <Separator />

      <Section
        id="cards"
        title="Card states"
        hint="Every card in the app is this one. Interactive, selected and disabled are properties of it, not classes a screen writes for itself."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <p className="text-card-title">Resting</p>
            <p className="mt-1 text-sm text-muted-foreground">The default surface.</p>
          </Card>
          <Card interactive className="p-4">
            <p className="text-card-title">Interactive</p>
            <p className="mt-1 text-sm text-muted-foreground">Lifts on hover, presses on click.</p>
          </Card>
          <Card selected className="p-4">
            <p className="text-card-title">Selected</p>
            <p className="mt-1 text-sm text-muted-foreground">Chosen out of a set.</p>
          </Card>
          <Card disabled className="p-4">
            <p className="text-card-title">Disabled</p>
            <p className="mt-1 text-sm text-muted-foreground">Present but unavailable.</p>
          </Card>
        </div>

        <div className="mt-4">
          <p className="text-eyebrow mb-2">Categorical accents</p>
          <div className="flex flex-wrap gap-2">
            {ACCENT_CLASSES.map((cls, i) => (
              <span
                key={cls}
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-xs font-semibold ${cls}`}
              >
                {i + 1}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-2xs text-muted-foreground">
            Used for telling things apart, never for judging them. A module keeps its
            accent for as long as it exists.
          </p>
        </div>
      </Section>

      <Separator />

      <Section
        id="toolbar"
        title="Toolbar &amp; selection"
        hint="Fixed height so a table's first row starts at the same offset on every screen."
      >
        <Card className="overflow-hidden p-0">
          <Toolbar>
            <ToolbarStart>
              <Input placeholder="بحث في السجلات…" className="h-8 w-64" />
              <Button size="sm" variant="outline">
                تصفية
              </Button>
              <ToolbarSeparator />
              <span className="text-2xs text-muted-foreground">20 سجل</span>
            </ToolbarStart>
            <ToolbarEnd>
              <Button size="sm" variant="outline">
                تصدير
              </Button>
              <Button size="sm">إضافة</Button>
            </ToolbarEnd>
          </Toolbar>

          <SelectionBar
            count={selected}
            label={`${selected} عنصر محدد`}
            onClear={() => setSelected(0)}
            clearLabel="إلغاء التحديد"
          >
            <Button size="sm" variant="destructive">
              حذف
            </Button>
          </SelectionBar>

          <div className="flex items-center gap-2 p-3">
            <Button size="sm" variant="ghost" onClick={() => setSelected(3)}>
              حدّد 3 عناصر (معاينة)
            </Button>
          </div>
        </Card>
      </Section>

      <Separator />

      <Section
        id="states"
        title="Empty, loading &amp; error"
        hint="The three most-reinvented surfaces in the app. Loading reserves the shape of the content it replaces, so nothing shifts when data lands."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardContent className="p-0">
              <EmptyState
                compact
                title="لا توجد سجلات"
                description="ابدأ بإضافة أول سجل لهذه الوحدة."
                action={<Button size="sm">إضافة سجل</Button>}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <LoadingState variant="table" count={4} label="جارٍ التحميل" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <ErrorState
                compact
                title="تعذّر تحميل البيانات"
                description="حدث خطأ أثناء الاتصال بالخادم."
                retryLabel="إعادة المحاولة"
                onRetry={() => undefined}
                detailLabel="تفاصيل تقنية"
                detail="HTTP 500 — request id 4f2a9c"
              />
            </CardContent>
          </Card>
        </div>
      </Section>
    </div>
  );
}
