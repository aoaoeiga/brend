import { supabase } from "@/lib/supabase";

/**
 * 月次報告書のデータ取得・集計モジュール。
 * 指定された年月（"YYYY-MM"）について、Supabase から全データを取得し、
 * 7 セクション分の集計済みデータを返す。
 */

const DEFAULT_COST_RATE = 30; // cost_rate 未設定時のデフォルト原価率(%)

const CATEGORY_LABELS: Record<string, string> = {
  fast_coffee: "Fast Coffee",
  drip_coffee: "Drip Coffee",
  other_drinks: "Other Drinks",
  food: "Food",
};

const EXPENSE_CATEGORIES = ["材料費", "人件費", "光熱費", "家賃", "その他"];

interface OrderRow {
  id: string;
  total: number;
  staff_id: string | null;
  paid_at: string | null;
}

interface ItemRow {
  quantity: number;
  subtotal: number;
  menus: { name: string; category: string; price: number; cost_rate: number | null } | null;
}

interface ExpenseRow {
  category: string;
  amount: number;
}

interface StaffRow {
  id: string;
  name: string;
}

// === 出力構造 ===

export interface ReportCell {
  value: string | number;
  /** 増減セルの符号（色分け用）。"pos"=緑 / "neg"=赤 */
  delta?: "pos" | "neg";
  align?: "left" | "right" | "center";
}

export interface ReportSection {
  title: string;
  columns: string[];
  rows: ReportCell[][];
}

export interface MonthlyReport {
  year: number;
  month: number;
  label: string; // "2026年6月"
  generatedAt: string; // "2026年6月1日"
  sections: ReportSection[];
}

// === ヘルパー ===

const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

/** 増減額セル（符号付き・色分け） */
function deltaAmount(curr: number, prev: number): ReportCell {
  const diff = Math.round(curr - prev);
  const sign = diff > 0 ? "+" : diff < 0 ? "-" : "";
  return {
    value: `${sign}¥${Math.abs(diff).toLocaleString("ja-JP")}`,
    delta: diff > 0 ? "pos" : diff < 0 ? "neg" : undefined,
    align: "right",
  };
}

/** 増減率セル（符号付き・色分け）。前月 0 の場合は "—" */
function deltaRate(curr: number, prev: number): ReportCell {
  if (prev === 0) return { value: "—", align: "right" };
  const rate = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = rate > 0 ? "+" : rate < 0 ? "-" : "";
  return {
    value: `${sign}${Math.abs(rate).toFixed(1)}%`,
    delta: rate > 0 ? "pos" : rate < 0 ? "neg" : undefined,
    align: "right",
  };
}

function dayKey(paidAt: string): string {
  // Asia/Tokyo の日付（YYYY-MM-DD）に正規化
  const d = new Date(paidAt);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

function monthBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
  return { start, end, endDay };
}

function totalCostOf(items: ItemRow[]): number {
  return items.reduce((sum, i) => {
    const rate = i.menus?.cost_rate ?? DEFAULT_COST_RATE;
    return sum + i.subtotal * (rate / 100);
  }, 0);
}

/**
 * 指定年月の月次報告書データを生成する。
 */
export async function buildMonthlyReport(yearMonth: string): Promise<MonthlyReport> {
  if (!supabase) throw new Error("Supabase が設定されていません。");

  const [year, month] = yearMonth.split("-").map(Number);
  const { start, end, endDay } = monthBounds(year, month);

  // 前月
  const pmYear = month === 1 ? year - 1 : year;
  const pmMonth = month === 1 ? 12 : month - 1;
  const pm = monthBounds(pmYear, pmMonth);

  // 当月の注文 ID を取得
  const { data: curOrderIdRows } = await supabase
    .from("orders")
    .select("id")
    .gte("paid_at", `${start}T00:00:00`)
    .lte("paid_at", `${end}T23:59:59`)
    .eq("status", "paid");
  const curIds = (curOrderIdRows || []).map((o: { id: string }) => o.id);

  const { data: pmOrderIdRows } = await supabase
    .from("orders")
    .select("id")
    .gte("paid_at", `${pm.start}T00:00:00`)
    .lte("paid_at", `${pm.end}T23:59:59`)
    .eq("status", "paid");
  const pmIds = (pmOrderIdRows || []).map((o: { id: string }) => o.id);

  const [ordersRes, itemsRes, expensesRes, staffsRes, pmItemsRes, pmExpensesRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total, staff_id, paid_at")
      .gte("paid_at", `${start}T00:00:00`)
      .lte("paid_at", `${end}T23:59:59`)
      .eq("status", "paid")
      .order("paid_at"),
    curIds.length > 0
      ? supabase.from("order_items").select("quantity, subtotal, menus(name, category, price, cost_rate)").in("order_id", curIds)
      : Promise.resolve({ data: [] as ItemRow[] }),
    supabase.from("expenses").select("category, amount").gte("date", start).lte("date", end),
    supabase.from("staffs").select("id, name").order("name"),
    pmIds.length > 0
      ? supabase.from("order_items").select("quantity, subtotal, menus(name, category, price, cost_rate)").in("order_id", pmIds)
      : Promise.resolve({ data: [] as ItemRow[] }),
    supabase.from("expenses").select("category, amount").gte("date", pm.start).lte("date", pm.end),
  ]);

  const orders = (ordersRes.data || []) as OrderRow[];
  const items = (itemsRes.data || []) as unknown as ItemRow[];
  const expenses = (expensesRes.data || []) as ExpenseRow[];
  const staffs = (staffsRes.data || []) as StaffRow[];
  const pmItems = (pmItemsRes.data || []) as unknown as ItemRow[];
  const pmExpenses = (pmExpensesRes.data || []) as ExpenseRow[];

  // === 共通集計 ===
  const sales = orders.reduce((s, o) => s + o.total, 0);
  const cost = totalCostOf(items);
  const gross = sales - cost;
  const expTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const operating = gross - expTotal;

  // 前月分（売上は注文 ID 数では取れないので別途取得）
  const { data: pmTotalsRows } = await supabase
    .from("orders")
    .select("total")
    .gte("paid_at", `${pm.start}T00:00:00`)
    .lte("paid_at", `${pm.end}T23:59:59`)
    .eq("status", "paid");
  const pmSales = (pmTotalsRows || []).reduce((s: number, o: { total: number }) => s + o.total, 0);
  const pmCost = totalCostOf(pmItems);
  const pmGross = pmSales - pmCost;
  const pmExpTotal = pmExpenses.reduce((s, e) => s + e.amount, 0);
  const pmOperating = pmGross - pmExpTotal;

  const sections: ReportSection[] = [];

  // === 1. 損益サマリー ===
  const plRow = (label: string, curr: number, prev: number): ReportCell[] => [
    { value: label, align: "left" },
    { value: yen(curr), align: "right" },
    { value: yen(prev), align: "right" },
    deltaAmount(curr, prev),
    deltaRate(curr, prev),
  ];
  sections.push({
    title: "1. 損益サマリー",
    columns: ["項目", "当月", "前月", "増減額", "増減率"],
    rows: [
      plRow("売上高", sales, pmSales),
      plRow("売上原価", cost, pmCost),
      plRow("売上総利益（粗利）", gross, pmGross),
      plRow("経費", expTotal, pmExpTotal),
      plRow("営業利益", operating, pmOperating),
    ],
  });

  // === 2. 営業指標 ===
  const orderCount = orders.length;
  const dailySalesMap: Record<string, number> = {};
  orders.forEach((o) => {
    if (!o.paid_at) return;
    const k = dayKey(o.paid_at);
    dailySalesMap[k] = (dailySalesMap[k] || 0) + o.total;
  });
  const businessDays = Object.keys(dailySalesMap).length;
  const dailyAvg = businessDays > 0 ? sales / businessDays : 0;
  const avgTicket = orderCount > 0 ? sales / orderCount : 0;

  const dailyEntries = Object.entries(dailySalesMap);
  let maxDay = { date: "—", value: 0 };
  let minDay = { date: "—", value: 0 };
  if (dailyEntries.length > 0) {
    const sorted = [...dailyEntries].sort((a, b) => b[1] - a[1]);
    const fmtDate = (d: string) => {
      const [, m, dd] = d.split("-");
      return `${Number(m)}月${Number(dd)}日`;
    };
    maxDay = { date: fmtDate(sorted[0][0]), value: sorted[0][1] };
    minDay = { date: fmtDate(sorted[sorted.length - 1][0]), value: sorted[sorted.length - 1][1] };
  }
  sections.push({
    title: "2. 営業指標",
    columns: ["指標", "値"],
    rows: [
      [{ value: "総注文数", align: "left" }, { value: `${orderCount.toLocaleString("ja-JP")}件`, align: "right" }],
      [{ value: "営業日数", align: "left" }, { value: `${businessDays}日`, align: "right" }],
      [{ value: "日平均売上", align: "left" }, { value: yen(dailyAvg), align: "right" }],
      [{ value: "客単価", align: "left" }, { value: yen(avgTicket), align: "right" }],
      [{ value: "最高売上日", align: "left" }, { value: `${maxDay.date}（${yen(maxDay.value)}）`, align: "right" }],
      [{ value: "最低売上日", align: "left" }, { value: `${minDay.date}（${yen(minDay.value)}）`, align: "right" }],
    ],
  });

  // === 3. 商品別実績 ===
  interface ProdAgg {
    name: string;
    price: number;
    qty: number;
    sales: number;
    cost: number;
  }
  const prodMap: Record<string, ProdAgg> = {};
  items.forEach((i) => {
    const name = i.menus?.name || "不明";
    const rate = i.menus?.cost_rate ?? DEFAULT_COST_RATE;
    if (!prodMap[name]) prodMap[name] = { name, price: i.menus?.price ?? 0, qty: 0, sales: 0, cost: 0 };
    prodMap[name].qty += i.quantity;
    prodMap[name].sales += i.subtotal;
    prodMap[name].cost += i.subtotal * (rate / 100);
  });
  const prodList = Object.values(prodMap).sort((a, b) => b.sales - a.sales);
  sections.push({
    title: "3. 商品別実績",
    columns: ["商品名", "単価", "販売数", "売上", "構成比", "粗利"],
    rows: prodList.map((p) => [
      { value: p.name, align: "left" as const },
      { value: yen(p.price), align: "right" as const },
      { value: `${p.qty.toLocaleString("ja-JP")}`, align: "right" as const },
      { value: yen(p.sales), align: "right" as const },
      { value: pct(sales > 0 ? (p.sales / sales) * 100 : 0), align: "right" as const },
      { value: yen(p.sales - p.cost), align: "right" as const },
    ]),
  });

  // === 4. 経費明細 ===
  const expByCat: Record<string, number> = {};
  const pmExpByCat: Record<string, number> = {};
  expenses.forEach((e) => (expByCat[e.category] = (expByCat[e.category] || 0) + e.amount));
  pmExpenses.forEach((e) => (pmExpByCat[e.category] = (pmExpByCat[e.category] || 0) + e.amount));
  const allCats = Array.from(new Set([...EXPENSE_CATEGORIES, ...Object.keys(expByCat), ...Object.keys(pmExpByCat)]));
  const expCatRows = allCats
    .filter((c) => (expByCat[c] || 0) > 0 || (pmExpByCat[c] || 0) > 0)
    .map((c) => {
      const curr = expByCat[c] || 0;
      const prev = pmExpByCat[c] || 0;
      return [
        { value: c, align: "left" as const },
        { value: yen(curr), align: "right" as const },
        { value: yen(prev), align: "right" as const },
        deltaRate(curr, prev),
        { value: pct(sales > 0 ? (curr / sales) * 100 : 0), align: "right" as const },
      ];
    });
  expCatRows.push([
    { value: "合計", align: "left" },
    { value: yen(expTotal), align: "right" },
    { value: yen(pmExpTotal), align: "right" },
    deltaRate(expTotal, pmExpTotal),
    { value: pct(sales > 0 ? (expTotal / sales) * 100 : 0), align: "right" },
  ]);
  sections.push({
    title: "4. 経費明細",
    columns: ["カテゴリ", "当月", "前月", "増減率", "対売上比"],
    rows: expCatRows,
  });

  // === 5. カテゴリ別分析 ===
  interface CatAgg {
    qty: number;
    sales: number;
  }
  const catMap: Record<string, CatAgg> = {};
  items.forEach((i) => {
    const cat = i.menus?.category || "other";
    const label = CATEGORY_LABELS[cat] || cat;
    if (!catMap[label]) catMap[label] = { qty: 0, sales: 0 };
    catMap[label].qty += i.quantity;
    catMap[label].sales += i.subtotal;
  });
  const catList = Object.entries(catMap).sort((a, b) => b[1].sales - a[1].sales);
  sections.push({
    title: "5. カテゴリ別分析",
    columns: ["カテゴリ", "数量", "売上", "構成比", "平均単価"],
    rows: catList.map(([label, c]) => [
      { value: label, align: "left" as const },
      { value: `${c.qty.toLocaleString("ja-JP")}`, align: "right" as const },
      { value: yen(c.sales), align: "right" as const },
      { value: pct(sales > 0 ? (c.sales / sales) * 100 : 0), align: "right" as const },
      { value: yen(c.qty > 0 ? c.sales / c.qty : 0), align: "right" as const },
    ]),
  });

  // === 6. 週別推移 ===
  // 月内を 7 日区切りの週に分割
  const weeks: { label: string; sales: number; orders: number; days: number }[] = [];
  for (let startDay = 1; startDay <= endDay; startDay += 7) {
    const lastDay = Math.min(startDay + 6, endDay);
    weeks.push({ label: `${month}/${startDay}〜${month}/${lastDay}`, sales: 0, orders: 0, days: lastDay - startDay + 1 });
  }
  orders.forEach((o) => {
    if (!o.paid_at) return;
    const day = Number(dayKey(o.paid_at).split("-")[2]);
    const idx = Math.floor((day - 1) / 7);
    if (weeks[idx]) {
      weeks[idx].sales += o.total;
      weeks[idx].orders += 1;
    }
  });
  sections.push({
    title: "6. 週別推移",
    columns: ["期間", "売上", "注文数", "日平均", "前週比"],
    rows: weeks.map((w, idx) => {
      const prev = idx > 0 ? weeks[idx - 1].sales : 0;
      return [
        { value: w.label, align: "left" as const },
        { value: yen(w.sales), align: "right" as const },
        { value: `${w.orders.toLocaleString("ja-JP")}件`, align: "right" as const },
        { value: yen(w.days > 0 ? w.sales / w.days : 0), align: "right" as const },
        idx === 0 ? { value: "—", align: "right" as const } : deltaRate(w.sales, prev),
      ];
    }),
  });

  // === 7. スタッフ別実績 ===
  const staffName: Record<string, string> = {};
  staffs.forEach((s) => (staffName[s.id] = s.name));
  interface StaffAgg {
    name: string;
    orders: number;
    sales: number;
  }
  const staffMap: Record<string, StaffAgg> = {};
  orders.forEach((o) => {
    const key = o.staff_id || "unknown";
    const name = staffName[key] || "不明";
    if (!staffMap[key]) staffMap[key] = { name, orders: 0, sales: 0 };
    staffMap[key].orders += 1;
    staffMap[key].sales += o.total;
  });
  const staffList = Object.values(staffMap).sort((a, b) => b.sales - a.sales);
  sections.push({
    title: "7. スタッフ別実績",
    columns: ["スタッフ名", "注文数", "売上", "客単価", "構成比"],
    rows: staffList.map((s) => [
      { value: s.name, align: "left" as const },
      { value: `${s.orders.toLocaleString("ja-JP")}件`, align: "right" as const },
      { value: yen(s.sales), align: "right" as const },
      { value: yen(s.orders > 0 ? s.sales / s.orders : 0), align: "right" as const },
      { value: pct(sales > 0 ? (s.sales / sales) * 100 : 0), align: "right" as const },
    ]),
  });

  const generated = new Date();
  const gjst = new Date(generated.getTime() + 9 * 60 * 60 * 1000);
  const [gy, gm, gd] = gjst.toISOString().split("T")[0].split("-");

  return {
    year,
    month,
    label: `${year}年${month}月`,
    generatedAt: `${gy}年${Number(gm)}月${Number(gd)}日`,
    sections,
  };
}
