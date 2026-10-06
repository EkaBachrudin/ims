import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import "./Charts.css";

export const chartColors = {
  inbound: "#10b981",
  outbound: "#ef4444",
  adjustment: "#f59e0b",
  bar: "#6366f1",
  axis: "#94a3b8",
  grid: "rgba(148, 163, 184, 0.25)",
};

const CHART_HEIGHT = 260;

const compact = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const full = new Intl.NumberFormat("id-ID");

function compactNumber(value: number | string): string {
  const n = Number(value);
  return Number.isFinite(n) ? compact.format(n) : String(value);
}

function truncate(value: string, max = 14): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};

type Datum = Record<string, string | number>;

export function TrendAreaChart({
  data,
  xKey,
  series,
}: {
  data: Datum[];
  xKey: string;
  series: { key: string; label: string; color: string }[];
}) {
  if (data.length === 0) {
    return <EmptyState title="Belum ada data" description="Tidak ada pergerakan pada periode ini." />;
  }
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12, fill: chartColors.axis }}
            tickLine={false}
            axisLine={false}
            minTickGap={16}
          />
          <YAxis
            tick={{ fontSize: 12, fill: chartColors.axis }}
            tickLine={false}
            axisLine={false}
            width={56}
            allowDecimals={false}
            tickFormatter={compactNumber}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "var(--muted-foreground)" }}
            formatter={(value) => full.format(Number(value))}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.12}
              strokeWidth={2}
              dot={data.length <= 2}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RankBarChart({
  data,
  xKey,
  yKey,
  label,
  color = chartColors.bar,
}: {
  data: Datum[];
  xKey: string;
  yKey: string;
  label: string;
  color?: string;
}) {
  if (data.length === 0) {
    return <EmptyState title="Belum ada data" description="Tidak ada data untuk ditampilkan." />;
  }
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
        <BarChart data={data} margin={{ top: 20, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12, fill: chartColors.axis }}
            tickLine={false}
            axisLine={false}
            interval={0}
            height={56}
            angle={-20}
            textAnchor="end"
            tickFormatter={(value) => truncate(String(value))}
          />
          <YAxis
            tick={{ fontSize: 12, fill: chartColors.axis }}
            tickLine={false}
            axisLine={false}
            width={56}
            allowDecimals={false}
            tickFormatter={compactNumber}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "var(--muted)" }}
            formatter={(value) => full.format(Number(value))}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
          <Bar
            dataKey={yKey}
            name={label}
            fill={color}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
            isAnimationActive={false}
          >
            <LabelList
              dataKey={yKey}
              position="top"
              formatter={compactNumber}
              style={{ fontSize: 11, fill: chartColors.axis }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
