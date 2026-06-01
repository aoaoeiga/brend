"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Navigation from "@/components/Navigation";
import { supabase } from "@/lib/supabase";
import { Order, Expense, MenuItem } from "@/lib/types";
import { buildMonthlyReport } from "@/lib/report-data";
import dynamic from "next/dynamic";

const SalesBarChart = dynamic(() => import("@/components/SalesChart").then((m) => m.SalesBarChart), { ssr: false });
const CategoryPieChart = dynamic(() => import("@/components/SalesChart").then((m) => m.CategoryPieChart), { ssr: false });
const HourlyBarChart = dynamic(() => import("@/components/SalesChart").then((m) => m.HourlyBarChart), { ssr: false });
const RankingBarChart = dynamic(() => import("@/components/SalesChart").then((m) => m.RankingBarChart), { ssr: false });

interface OrderItemWithMenu {
  quantity: number;
  subtotal: number;
  menus: { name: string; category: string; price: number; cost_rate: number | null };
}

export default function ReportPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [lastMonthSales, setLastMonthSales] = useState(0);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemWithMenu[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [tab, setTab] = useState<"dashboard" | "products" | "profit" | "expenses">("dashboard");
  const [expenseForm, setExpenseForm] = useState({
    name: "",
    amount: "",
    category: "材料費",
    date: new Date().toISOString().split("T")[0],
  });
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [downloadMonth, setDownloadMonth] = useState(selectedMonth);
  const [downloading, setDownloading] = useState<null | "excel" | "pdf">(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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
    const [year, month] = selectedMonth.split("-").map(Number);
    const startDate = `${selectedMonth}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endStr = `${selectedMonth}-${String(endDay).padStart(2, "0")}`;

    // Today
    const today = new Date().toISOString().split("T")[0];

    // Last month
    const lmYear = month === 1 ? year - 1 : year;
    const lmMonth = month === 1 ? 12 : month - 1;
    const lmStart = `${lmYear}-${String(lmMonth).padStart(2, "0")}-01`;
    const lmEndDay = new Date(lmYear, lmMonth, 0).getDate();
    const lmEnd = `${lmYear}-${String(lmMonth).padStart(2, "0")}-${String(lmEndDay).padStart(2, "0")}`;

    // Fetch order IDs for the month first
    const { data: monthOrderIds } = await supabase
      .from("orders")
      .select("id")
      .gte("paid_at", `${startDate}T00:00:00`)
      .lte("paid_at", `${endStr}T23:59:59`)
      .eq("status", "paid");

    const ids = monthOrderIds?.map((o: { id: string }) => o.id) || [];

    const [ordersRes, todayRes, lastMonthRes, expensesRes, itemsRes, menusRes] = await Promise.all([
      supabase.from("orders").select("*").gte("paid_at", `${startDate}T00:00:00`).lte("paid_at", `${endStr}T23:59:59`).eq("status", "paid").order("paid_at"),
      supabase.from("orders").select("*").gte("paid_at", `${today}T00:00:00`).lte("paid_at", `${today}T23:59:59`).eq("status", "paid"),
      supabase.from("orders").select("total").gte("paid_at", `${lmStart}T00:00:00`).lte("paid_at", `${lmEnd}T23:59:59`).eq("status", "paid"),
      supabase.from("expenses").select("*").gte("date", startDate).lte("date", endStr).order("date"),
      ids.length > 0
        ? supabase.from("order_items").select("quantity, subtotal, menus(name, category, price, cost_rate)").in("order_id", ids)
        : Promise.resolve({ data: [] }),
      supabase.from("menus").select("*").order("name"),
    ]);

    if (ordersRes.data) setOrders(ordersRes.data);
    if (todayRes.data) setTodayOrders(todayRes.data);
    setLastMonthSales(lastMonthRes.data?.reduce((s: number, o: { total: number }) => s + o.total, 0) || 0);
    if (expensesRes.data) setExpenses(expensesRes.data);
    if (itemsRes.data) setOrderItems(itemsRes.data as unknown as OrderItemWithMenu[]);
    if (menusRes.data) setMenus(menusRes.data);
  };

  // === Computed data ===
  const totalSales = orders.reduce((s, o) => s + o.total, 0);
  const todaySales = todayOrders.reduce((s, o) => s + o.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const monthComparison = lastMonthSales > 0 ? (((totalSales - lastMonthSales) / lastMonthSales) * 100).toFixed(1) : null;

  const dailyData = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      if (!o.paid_at) return;
      const d = new Date(o.paid_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });
      map[d] = (map[d] || 0) + o.total;
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [orders]);

  const ranking = useMemo(() => {
    const map: Record<string, number> = {};
    orderItems.forEach((i) => {
      const name = i.menus?.name || "不明";
      map[name] = (map[name] || 0) + i.quantity;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [orderItems]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    orderItems.forEach((i) => {
      const cat = i.menus?.category || "other";
      const label = cat === "fast_coffee" ? "Fast Coffee" : cat === "drip_coffee" ? "Drip Coffee" : cat === "other_drinks" ? "Other Drinks" : cat === "food" ? "Food" : cat;
      map[label] = (map[label] || 0) + i.subtotal;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [orderItems]);

  const hourlyData = useMemo(() => {
    const map: Record<number, number> = {};
    orders.forEach((o) => {
      if (!o.paid_at) return;
      const h = new Date(o.paid_at).getHours();
      map[h] = (map[h] || 0) + 1;
    });
    const result = [];
    for (let h = 7; h <= 22; h++) {
      result.push({ label: `${h}時`, value: map[h] || 0 });
    }
    return result;
  }, [orders]);

  // Profit calculations using cost_rate from menu items
  const profitData = useMemo(() => {
    let totalCost = 0;
    orderItems.forEach((i) => {
      const rate = i.menus?.cost_rate ?? 30; // default 30% if not set
      totalCost += i.subtotal * (rate / 100);
    });
    const grossProfit = totalSales - totalCost;
    const grossMargin = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : "0";
    const operatingProfit = totalSales - totalCost - totalExpenses;
    return { totalCost: Math.round(totalCost), grossProfit: Math.round(grossProfit), grossMargin, operatingProfit: Math.round(operatingProfit) };
  }, [orderItems, totalSales, totalExpenses]);

  // Per-menu cost rate editor data
  const menuCostData = useMemo(() => {
    return menus.map((m) => ({
      id: m.id,
      name: m.name,
      price: m.price,
      cost_rate: m.cost_rate ?? 30,
      category: m.category,
    }));
  }, [menus]);

  const handleCostRateChange = async (menuId: string, newRate: number) => {
    if (!supabase) return;
    await supabase.from("menus").update({ cost_rate: newRate }).eq("id", menuId);
    fetchData();
  };

  const handleDownload = async (format: "excel" | "pdf") => {
    setDownloadError(null);
    setDownloading(format);
    try {
      const report = await buildMonthlyReport(downloadMonth);
      const exporter = await import("@/lib/report-export");
      if (format === "excel") {
        exporter.downloadExcel(report);
      } else {
        await exporter.downloadPdf(report);
      }
    } catch (err) {
      console.error("月次報告書の生成に失敗しました:", err);
      setDownloadError(err instanceof Error ? err.message : "ダウンロードに失敗しました。");
    } finally {
      setDownloading(null);
    }
  };

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
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h2 className="text-2xl font-bold text-cafe-text font-serif">売上レポート</h2>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
          />
        </div>

        {/* Monthly report download */}
        <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4 mb-6 border border-cafe-accent/10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-lg font-bold text-cafe-text font-serif">月次報告書をダウンロード</h3>
              <p className="text-xs text-cafe-text/50 mt-1">対象月を選んで、Excel または PDF で全7セクションの報告書を出力します。</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-2">
              <div className="flex flex-col">
                <label className="text-xs text-cafe-text/60 mb-1">対象月</label>
                <input
                  type="month"
                  value={downloadMonth}
                  onChange={(e) => setDownloadMonth(e.target.value)}
                  className="px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
                />
              </div>
              <button
                onClick={() => handleDownload("excel")}
                disabled={downloading !== null}
                className="px-4 py-2 bg-cafe-success text-white rounded-cafe text-sm font-medium hover:bg-cafe-success/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {downloading === "excel" ? "生成中…" : "📊 Excelでダウンロード"}
              </button>
              <button
                onClick={() => handleDownload("pdf")}
                disabled={downloading !== null}
                className="px-4 py-2 bg-cafe-button text-white rounded-cafe text-sm font-medium hover:bg-cafe-button/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {downloading === "pdf" ? "生成中…" : "📄 PDFでダウンロード"}
              </button>
            </div>
          </div>
          {downloadError && <p className="text-xs text-cafe-danger mt-2">{downloadError}</p>}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-cafe-card rounded-cafe shadow-cafe p-4">
            <p className="text-xs text-cafe-text/60">今日の売上</p>
            <p className="text-xl font-bold text-cafe-accent">¥{todaySales.toLocaleString()}</p>
            <p className="text-xs text-cafe-text/40">{todayOrders.length}件</p>
          </div>
          <div className="bg-cafe-card rounded-cafe shadow-cafe p-4">
            <p className="text-xs text-cafe-text/60">今月の売上</p>
            <p className="text-xl font-bold text-cafe-accent">¥{totalSales.toLocaleString()}</p>
            <p className="text-xs text-cafe-text/40">{orders.length}件</p>
          </div>
          <div className="bg-cafe-card rounded-cafe shadow-cafe p-4">
            <p className="text-xs text-cafe-text/60">先月比</p>
            <p className={`text-xl font-bold ${monthComparison && parseFloat(monthComparison) >= 0 ? "text-cafe-success" : "text-cafe-danger"}`}>
              {monthComparison ? `${parseFloat(monthComparison) >= 0 ? "+" : ""}${monthComparison}%` : "-"}
            </p>
            <p className="text-xs text-cafe-text/40">先月: ¥{lastMonthSales.toLocaleString()}</p>
          </div>
          <div className="bg-cafe-card rounded-cafe shadow-cafe p-4">
            <p className="text-xs text-cafe-text/60">営業利益</p>
            <p className={`text-xl font-bold ${profitData.operatingProfit >= 0 ? "text-cafe-success" : "text-cafe-danger"}`}>
              ¥{profitData.operatingProfit.toLocaleString()}
            </p>
            <p className="text-xs text-cafe-text/40">粗利率 {profitData.grossMargin}%</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto">
          {([["dashboard", "ダッシュボード"], ["products", "商品分析"], ["profit", "利益管理"], ["expenses", "経費管理"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-cafe text-sm whitespace-nowrap transition-colors ${
                tab === key ? "bg-cafe-button text-white" : "bg-cafe-card text-cafe-text border border-cafe-accent/20"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Dashboard tab */}
        {tab === "dashboard" && (
          <div className="space-y-6">
            <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4">
              <h3 className="text-lg font-bold text-cafe-text font-serif mb-3">日別売上推移</h3>
              <SalesBarChart data={dailyData} />
            </div>
            <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4">
              <h3 className="text-lg font-bold text-cafe-text font-serif mb-3">時間帯別注文数</h3>
              <HourlyBarChart data={hourlyData} />
            </div>
            {/* Daily table */}
            <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4">
              <h3 className="text-lg font-bold text-cafe-text font-serif mb-3">日別売上一覧</h3>
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
                      <tr key={d.label} className="border-b border-cafe-accent/10">
                        <td className="py-2 px-2 text-cafe-text">{d.label}</td>
                        <td className="py-2 px-2 text-right font-medium text-cafe-text">¥{d.value.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Products tab */}
        {tab === "products" && (
          <div className="space-y-6">
            <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4">
              <h3 className="text-lg font-bold text-cafe-text font-serif mb-3">商品別販売数ランキング</h3>
              <RankingBarChart data={ranking.slice(0, 10)} />
            </div>
            <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4">
              <h3 className="text-lg font-bold text-cafe-text font-serif mb-3">カテゴリ別売上比率</h3>
              <CategoryPieChart data={categoryData} />
            </div>
            {/* Text ranking */}
            <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4">
              <h3 className="text-lg font-bold text-cafe-text font-serif mb-3">販売数詳細</h3>
              <div className="space-y-2">
                {ranking.map((item, idx) => (
                  <div key={item.name} className="flex items-center gap-3 bg-cafe-bg rounded-cafe p-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? "bg-yellow-400 text-white" : idx === 1 ? "bg-gray-300 text-white" : idx === 2 ? "bg-amber-600 text-white" : "bg-cafe-text/10 text-cafe-text/60"
                    }`}>{idx + 1}</span>
                    <span className="flex-1 text-sm text-cafe-text">{item.name}</span>
                    <span className="text-sm font-bold text-cafe-accent">{item.count}杯</span>
                  </div>
                ))}
                {ranking.length === 0 && <p className="text-cafe-text/40 text-center py-4">データなし</p>}
              </div>
            </div>
          </div>
        )}

        {/* Profit tab */}
        {tab === "profit" && (
          <div className="space-y-6">
            {/* Profit summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-cafe-card rounded-cafe shadow-cafe p-4">
                <p className="text-xs text-cafe-text/60">月間売上</p>
                <p className="text-xl font-bold text-cafe-accent">¥{totalSales.toLocaleString()}</p>
              </div>
              <div className="bg-cafe-card rounded-cafe shadow-cafe p-4">
                <p className="text-xs text-cafe-text/60">推定原価</p>
                <p className="text-xl font-bold text-cafe-danger">¥{profitData.totalCost.toLocaleString()}</p>
              </div>
              <div className="bg-cafe-card rounded-cafe shadow-cafe p-4">
                <p className="text-xs text-cafe-text/60">粗利</p>
                <p className="text-xl font-bold text-cafe-success">¥{profitData.grossProfit.toLocaleString()}</p>
              </div>
              <div className="bg-cafe-card rounded-cafe shadow-cafe p-4">
                <p className="text-xs text-cafe-text/60">粗利率</p>
                <p className="text-xl font-bold text-cafe-text">{profitData.grossMargin}%</p>
              </div>
            </div>

            <div className="bg-cafe-card rounded-cafe shadow-cafe p-4">
              <p className="text-sm text-cafe-text/60 mb-1">月間経費: ¥{totalExpenses.toLocaleString()}</p>
              <p className="text-lg font-bold text-cafe-text">
                営業利益（売上−原価−経費）:{" "}
                <span className={profitData.operatingProfit >= 0 ? "text-cafe-success" : "text-cafe-danger"}>
                  ¥{profitData.operatingProfit.toLocaleString()}
                </span>
              </p>
            </div>

            {/* Cost rate editor */}
            <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4">
              <h3 className="text-lg font-bold text-cafe-text font-serif mb-3">商品別 原価率設定</h3>
              <p className="text-xs text-cafe-text/50 mb-3">各商品の原価率を設定すると、利益が自動計算されます（未設定は30%で計算）</p>
              <div className="space-y-2">
                {menuCostData.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 bg-cafe-bg rounded-cafe p-2">
                    <span className="flex-1 text-sm text-cafe-text truncate">{m.name}</span>
                    <span className="text-xs text-cafe-text/50">¥{m.price}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={m.cost_rate}
                        onChange={(e) => handleCostRateChange(m.id, parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 border border-cafe-accent/20 rounded text-sm text-cafe-text bg-white text-right focus:outline-none focus:ring-1 focus:ring-cafe-accent/40"
                      />
                      <span className="text-xs text-cafe-text/50">%</span>
                    </div>
                    <span className="text-xs text-cafe-text/50 w-16 text-right">
                      原価 ¥{Math.round(m.price * m.cost_rate / 100)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Expenses tab */}
        {tab === "expenses" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-cafe-card rounded-cafe shadow-cafe p-4">
                <p className="text-xs text-cafe-text/60">月間売上</p>
                <p className="text-xl font-bold text-cafe-accent">¥{totalSales.toLocaleString()}</p>
              </div>
              <div className="bg-cafe-card rounded-cafe shadow-cafe p-4">
                <p className="text-xs text-cafe-text/60">月間経費</p>
                <p className="text-xl font-bold text-cafe-danger">¥{totalExpenses.toLocaleString()}</p>
              </div>
              <div className="bg-cafe-card rounded-cafe shadow-cafe p-4">
                <p className="text-xs text-cafe-text/60">営業利益</p>
                <p className={`text-xl font-bold ${profitData.operatingProfit >= 0 ? "text-cafe-success" : "text-cafe-danger"}`}>
                  ¥{profitData.operatingProfit.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold text-cafe-text font-serif">経費一覧</h3>
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
                    <button type="submit" className="px-4 py-2 bg-cafe-button text-white rounded-cafe text-sm font-medium hover:bg-cafe-button/90 transition-colors">
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
                      <button onClick={() => handleDeleteExpense(exp.id)} className="text-cafe-danger/60 hover:text-cafe-danger text-xs">
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                {expenses.length === 0 && <p className="text-cafe-text/40 text-center py-4">経費データなし</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </Navigation>
  );
}
