"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ChartData {
  date: string;
  total: number;
}

export default function SalesChart({ data }: { data: ChartData[] }) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-cafe-text/40">
        データなし
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#C4724E20" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#3E2C1C" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#3E2C1C" }}
          tickLine={false}
          tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value) => [`¥${Number(value).toLocaleString()}`, "売上"]}
          contentStyle={{
            backgroundColor: "#FFF8F0",
            border: "1px solid #C4724E40",
            borderRadius: "12px",
            fontSize: "13px",
          }}
        />
        <Bar dataKey="total" fill="#C4724E" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
