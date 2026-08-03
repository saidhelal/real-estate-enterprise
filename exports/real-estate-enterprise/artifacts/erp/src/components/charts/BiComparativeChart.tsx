import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface BiComparativeChartProps {
  data: any[];
  dataKeys: [string, string];
  config: ChartConfig;
  xKey: string;
  variant?: "bar" | "line";
  className?: string;
}

export function BiComparativeChart({
  data,
  dataKeys,
  config,
  xKey,
  variant = "bar",
  className,
}: BiComparativeChartProps) {
  const chartData = data.map((row) => {
    const next: Record<string, unknown> = { ...row };
    for (const key of dataKeys) {
      next[key] = Number(row[key] ?? 0);
    }
    return next;
  });

  if (variant === "line") {
    return (
      <ChartContainer config={config} className={className}>
        <LineChart data={chartData} margin={{ left: 12, right: 12, top: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={48} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {dataKeys.map((key) => (
            <Line
              key={key}
              dataKey={key}
              type="monotone"
              stroke={`var(--color-${key})`}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer config={config} className={className}>
      <BarChart data={chartData} margin={{ left: 12, right: 12, top: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={48} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {dataKeys.map((key) => (
          <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={4} />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
