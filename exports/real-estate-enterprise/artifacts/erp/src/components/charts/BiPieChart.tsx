import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface BiPieChartProps {
  data: any[];
  dataKey: string;
  nameKey: string;
  config: ChartConfig;
  className?: string;
}

const PALETTE = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export function BiPieChart({ data, dataKey, nameKey, config, className }: BiPieChartProps) {
  const chartData = data.map((row, index) => ({
    ...row,
    [dataKey]: Number(row[dataKey] ?? 0),
    fill: PALETTE[index % PALETTE.length],
  }));

  return (
    <ChartContainer config={config} className={className}>
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey={nameKey} />} />
        <Pie data={chartData} dataKey={dataKey} nameKey={nameKey} innerRadius={50} strokeWidth={2}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.fill} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey={nameKey} />} />
      </PieChart>
    </ChartContainer>
  );
}
