"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

interface BarData {
  label: string;
  value: number;
}

const COLORS = ["#C4724E", "#6B8E5A", "#5C3D2E", "#C25550", "#8B6914", "#4A7C8F"];

export function SalesBarChart({ data, yFormatter }: { data: BarData[]; yFormatter?: (v: number) => string }) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-cafe-text/40">データなし</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#C4724E20" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#3E2C1C" }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: "#3E2C1C" }}
          tickLine={false}
          tickFormatter={yFormatter || ((v) => `¥${(v / 1000).toFixed(0)}k`)}
        />
        <Tooltip
          formatter={(value) => [`¥${Number(value).toLocaleString()}`, "売上"]}
          contentStyle={{ backgroundColor: "#FFF8F0", border: "1px solid #C4724E40", borderRadius: "12px", fontSize: "13px" }}
        />
        <Bar dataKey="value" fill="#C4724E" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryPieChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-cafe-text/40">データなし</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          dataKey="value"
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [`¥${Number(value).toLocaleString()}`, "売上"]}
          contentStyle={{ backgroundColor: "#FFF8F0", border: "1px solid #C4724E40", borderRadius: "12px", fontSize: "13px" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HourlyBarChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-cafe-text/40">データなし</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#C4724E20" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#3E2C1C" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#3E2C1C" }} tickLine={false} allowDecimals={false} />
        <Tooltip
          formatter={(value) => [`${Number(value)}件`, "注文数"]}
          contentStyle={{ backgroundColor: "#FFF8F0", border: "1px solid #C4724E40", borderRadius: "12px", fontSize: "13px" }}
        />
        <Bar dataKey="value" fill="#6B8E5A" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProfitLineChart({ data }: { data: { label: string; sales: number; cost: number; profit: number }[] }) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-cafe-text/40">データなし</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#C4724E20" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#3E2C1C" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#3E2C1C" }} tickLine={false} tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(value, name) => [`¥${Number(value).toLocaleString()}`, name === "sales" ? "売上" : name === "cost" ? "原価" : "粗利"]}
          contentStyle={{ backgroundColor: "#FFF8F0", border: "1px solid #C4724E40", borderRadius: "12px", fontSize: "13px" }}
        />
        <Line type="monotone" dataKey="sales" stroke="#C4724E" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="cost" stroke="#C25550" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="profit" stroke="#6B8E5A" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RankingBarChart({ data }: { data: { name: string; count: number }[] }) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-cafe-text/40">データなし</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#C4724E20" />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#3E2C1C" }} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#3E2C1C" }} width={80} />
        <Tooltip
          formatter={(value) => [`${Number(value)}杯`, "販売数"]}
          contentStyle={{ backgroundColor: "#FFF8F0", border: "1px solid #C4724E40", borderRadius: "12px", fontSize: "13px" }}
        />
        <Bar dataKey="count" fill="#C4724E" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
