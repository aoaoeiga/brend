"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Navigation from "@/components/Navigation";
import { supabase } from "@/lib/supabase";
import { Order, Expense } from "@/lib/types";
import dynamic from "next/dynamic";

const RechartsChart = dynamic(() => import("@/components/SalesChart"), {
  ssr: false,
  loading: () => <div className="h-64 bg-cafe-bg rounded-cafe animate-pulse" />,
});

interface OrderItemWithMenu {
  quantity: number;
  menus: { name: string };
}

export default function ReportPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemWithMenu[]>([]);
  const [viewMode, setViewMode] = useState<"daily" | "monthly">("daily");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [expenseForm, setExpenseForm] = useState({
    name: "",
    amount: "",
    category: "材料費",
    date: new Date().toISOString().split("T")[0],
  });
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, router, selectedMonth]);

  const fetchData = async () => {
    if (!supabase) return;
    const startDate = `${selectedMonth}-01`;
    const [year, month] = selectedMonth.split("-").map(Number);
    const endDate = new Date(year, month, 0);
    const endStr = `${selectedMonth}-${String(endDate.getDate()).padStart(2, "0")}`;

    const [ordersRes, expensesRes, itemsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .gte("paid_at", `${startDate}T00:00:00`)
        .lte("paid_at", `${endStr}T23:59:59`)
        .eq("status", "paid")
        .order("paid_at"),
      supabase
        .from("expenses")
        .select("*")
        .gte("date", startDate)
        .lte("date", endStr)
        .order("date"),
      supabase
        .from("order_items")
        .select("quantity, menus(name)")
        .in(
          "order_id",
          (
            await supabase
              .from("orders")
              .select("id")
              .gte("paid_at", `${startDate}T00:00:00`)
              .lte("paid_at", `${endStr}T23:59:59`)
              .eq("status", "paid")
          ).data?.map((o: { id: string }) => o.id) || []
        ),
    ]);

    if (ordersRes.data) setOrders(ordersRes.data);
    if (expensesRes.data) setExpenses(expensesRes.data);
    if (itemsRes.data) setOrderItems(itemsRes.data as unknown as OrderItemWithMenu[]);
  };

  const dailyData = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((order) => {
      if (!order.paid_at) return;
      const date = new Date(order.paid_at)
        .toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
        .replace(/\//g, "-");
      map[date] = (map[date] || 0) + order.total;
    });
    return Object.entries(map)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [orders]);

  const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = totalSales - totalExpenses;
  const profitRate = totalSales > 0 ? ((profit / totalSales) * 100).toFixed(1) : "0";

  const ranking = useMemo(() => {
    const map: Record<string, number> = {};
    orderItems.forEach((item) => {
      const name = item.menus?.name || "不明";
      map[name] = (map[name] || 0) + item.quantity;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [orderItems]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    await supabase.from("expenses").insert({
      name: expenseForm.name,
      amount: parseInt(expenseForm.amount),
      category: expenseForm.category,
      date: expenseForm.date,
    });
    setExpenseForm({ name: "", amount: "", category: "材料費", date: new Date().toISOString().split("T")[0] });
    setShowExpenseForm(false);
    fetchData();
  };

  const handleDeleteExpense = async (id: string) => {
    if (!supabase || !confirm("この経費を削除しますか？")) return;
    await supabase.from("expenses").delete().eq("id", id);
    fetchData();
  };

  if (!isAuthenticated) return null;

  return (
    <Navigation>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-cafe-text font-serif mb-4">
          売上レポート
        </h2>

        {/* Month selector */}
        <div className="flex gap-3 items-center mb-6">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
          />
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode("daily")}
              className={`px-3 py-2 rounded-cafe text-sm ${viewMode === "daily" ? "bg-cafe-button text-white" : "bg-cafe-card text-cafe-text border border-cafe-accent/20"}`}
            >
              日別
            </button>
            <button
              onClick={() => setViewMode("monthly")}
              className={`px-3 py-2 rounded-cafe text-sm ${viewMode === "monthly" ? "bg-cafe-button text-white" : "bg-cafe-card text-cafe-text border border-cafe-accent/20"}`}
            >
              月次
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-cafe-card rounded-cafe shadow-cafe p-4">
            <p className="text-xs text-cafe-text/60">月間売上</p>
            <p className="text-xl font-bold text-cafe-accent">¥{totalSales.toLocaleString()}</p>
          </div>
          <div className="bg-cafe-card rounded-cafe shadow-cafe p-4">
            <p className="text-xs text-cafe-text/60">月間経費</p>
            <p className="text-xl font-bold text-cafe-danger">¥{totalExpenses.toLocaleString()}</p>
          </div>
          <div className="bg-cafe-card rounded-cafe shadow-cafe p-4">
            <p className="text-xs text-cafe-text/60">月間利益</p>
            <p className={`text-xl font-bold ${profit >= 0 ? "text-cafe-success" : "text-cafe-danger"}`}>
              ¥{profit.toLocaleString()}
            </p>
          </div>
          <div className="bg-cafe-card rounded-cafe shadow-cafe p-4">
            <p className="text-xs text-cafe-text/60">利益率</p>
            <p className="text-xl font-bold text-cafe-text">{profitRate}%</p>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4 mb-6">
          <h3 className="text-lg font-bold text-cafe-text font-serif mb-3">
            {viewMode === "daily" ? "日別売上推移" : "月次サマリー"}
          </h3>
          <RechartsChart data={dailyData} />
        </div>

        {/* Sales table */}
        {viewMode === "daily" && (
          <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4 mb-6">
            <h3 className="text-lg font-bold text-cafe-text font-serif mb-3">
              日別売上一覧
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cafe-accent/20">
                    <th className="text-left py-2 px-2 text-cafe-text/60">日付</th>
                    <th className="text-right py-2 px-2 text-cafe-text/60">売上</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyData.map((d) => (
                    <tr key={d.date} className="border-b border-cafe-accent/10">
                      <td className="py-2 px-2 text-cafe-text">{d.date}</td>
                      <td className="py-2 px-2 text-right font-medium text-cafe-text">
                        ¥{d.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Product ranking */}
        <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4 mb-6">
          <h3 className="text-lg font-bold text-cafe-text font-serif mb-3">
            商品別販売数ランキング
          </h3>
          <div className="space-y-2">
            {ranking.map((item, idx) => (
              <div
                key={item.name}
                className="flex items-center gap-3 bg-cafe-bg rounded-cafe p-2"
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  idx === 0 ? "bg-yellow-400 text-white" :
                  idx === 1 ? "bg-gray-300 text-white" :
                  idx === 2 ? "bg-amber-600 text-white" :
                  "bg-cafe-text/10 text-cafe-text/60"
                }`}>
                  {idx + 1}
                </span>
                <span className="flex-1 text-sm text-cafe-text">{item.name}</span>
                <span className="text-sm font-bold text-cafe-accent">{item.count}杯</span>
              </div>
            ))}
            {ranking.length === 0 && (
              <p className="text-cafe-text/40 text-center py-4">データなし</p>
            )}
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-bold text-cafe-text font-serif">
              経費管理
            </h3>
            <button
              onClick={() => setShowExpenseForm(!showExpenseForm)}
              className="px-3 py-1 bg-cafe-success text-white rounded-cafe text-sm font-medium hover:bg-cafe-success/90 transition-colors"
            >
              ＋ 経費追加
            </button>
          </div>

          {showExpenseForm && (
            <form onSubmit={handleAddExpense} className="bg-cafe-bg rounded-cafe p-3 mb-3 space-y-2">
              <input
                type="text"
                placeholder="経費名"
                value={expenseForm.name}
                onChange={(e) => setExpenseForm((p) => ({ ...p, name: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text text-sm focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="金額"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                  required
                  min="0"
                  className="flex-1 px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text text-sm focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
                />
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text text-sm focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
                >
                  <option value="材料費">材料費</option>
                  <option value="人件費">人件費</option>
                  <option value="光熱費">光熱費</option>
                  <option value="家賃">家賃</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text text-sm focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-cafe-button text-white rounded-cafe text-sm font-medium hover:bg-cafe-button/90 transition-colors"
                >
                  追加
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {expenses.map((exp) => (
              <div key={exp.id} className="flex items-center justify-between bg-cafe-bg rounded-cafe p-2">
                <div>
                  <p className="text-sm font-medium text-cafe-text">{exp.name}</p>
                  <p className="text-xs text-cafe-text/60">{exp.date} / {exp.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-cafe-danger">¥{exp.amount.toLocaleString()}</span>
                  <button
                    onClick={() => handleDeleteExpense(exp.id)}
                    className="text-cafe-danger/60 hover:text-cafe-danger text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {expenses.length === 0 && (
              <p className="text-cafe-text/40 text-center py-4">経費データなし</p>
            )}
          </div>
        </div>
      </div>
    </Navigation>
  );
}
