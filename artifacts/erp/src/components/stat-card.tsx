import { KpiCard } from "@/components/ui/kpi-card";

/**
 * Compact metric tile.
 *
 * Kept as a named export with its original signature because a number of pages
 * already import it, but the rendering now lives in `KpiCard` — there is one
 * metric tile in the system, not two that drift apart. Reach for `KpiCard`
 * directly in new code: it adds trend, tone and drill-down.
 */
export function StatCard({
  title,
  value,
  icon: Icon,
  isLoading,
}: {
  title: string;
  value?: number | string;
  icon: React.ComponentType<{ className?: string }>;
  isLoading: boolean;
}) {
  return (
    <KpiCard
      label={title}
      icon={Icon}
      isLoading={isLoading}
      // Preserves the previous behaviour exactly: numbers are localised, and a
      // missing value renders as 0 rather than as an em dash.
      value={typeof value === "number" ? value.toLocaleString() : (value ?? 0)}
    />
  );
}
