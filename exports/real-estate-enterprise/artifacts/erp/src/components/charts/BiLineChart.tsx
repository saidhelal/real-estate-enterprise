import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface BiLineChartProps {
  data: any[];
  dataKeys: string[];
  config: ChartConfig;
  xKey: string;
  className?: string;
}

export function BiLineChart({ data, dataKeys, config, xKey, className }: BiLineChartProps) {
  const chartData = data.map((row) => {
    const next: Record<string, unknown> = { ...row };
    for (const key of dataKeys) {
      next[key] = Number(row[key] ?? 0);
    }
    return next;
  });

  return (
    <ChartContainer config={config} className={className}>
      <LineChart data={chartData} margin={{ left: 12, right: 12, top: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={48} />
        <ChartTooltip content={<ChartTooltipContent />} />
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
