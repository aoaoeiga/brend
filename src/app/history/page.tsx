"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Navigation from "@/components/Navigation";
import { supabase } from "@/lib/supabase";
import { OrderWithItems, Staff, MenuItem } from "@/lib/types";

export default function HistoryPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [filterStaff, setFilterStaff] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [searchAmount, setSearchAmount] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
      return;
    }
    fetchOrders();
    fetchStaffs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, router]);

  const fetchStaffs = async () => {
    if (!supabase) return;
    const { data } = await supabase.from("staffs").select("*").order("name");
    if (data) setStaffList(data);
  };

  const fetchOrders = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*, menus(*)), staffs(*)")
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(200);
    if (data) setOrders(data as unknown as OrderWithItems[]);
    setLoading(false);
  };

  const filteredOrders = orders.filter((order) => {
    if (filterStaff && order.staff_id !== filterStaff) return false;
    if (filterDate && order.paid_at) {
      const orderDate = new Date(order.paid_at)
        .toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
        .replace(/\//g, "-");
      if (!orderDate.includes(filterDate)) return false;
    }
    if (searchAmount && !String(order.total).includes(searchAmount)) return false;
    return true;
  });

  const exportPDF = async (mode: "daily" | "monthly") => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const title = mode === "daily" ? "日次レポート" : "月次レポート";

    doc.setFontSize(18);
    doc.text(`Cafe BRE+ND - ${title}`, 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`, 14, 30);

    let y = 40;
    doc.setFontSize(10);
    doc.text("Date", 14, y);
    doc.text("Staff", 60, y);
    doc.text("Total", 120, y);
    doc.text("Items", 150, y);
    y += 6;
    doc.line(14, y, 196, y);
    y += 4;

    const ordersToExport = filteredOrders.slice(0, 50);
    let grandTotal = 0;

    ordersToExport.forEach((order) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const date = order.paid_at
        ? new Date(order.paid_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
        : "-";
      const staffName = order.staffs?.name || "-";
      const itemCount = order.order_items?.reduce((s, i) => s + i.quantity, 0) || 0;
      grandTotal += order.total;

      doc.text(date, 14, y);
      doc.text(staffName, 60, y);
      doc.text(`Y${order.total.toLocaleString()}`, 120, y);
      doc.text(String(itemCount), 150, y);
      y += 6;
    });

    y += 4;
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFontSize(12);
    doc.text(`Total: Y${grandTotal.toLocaleString()} (${ordersToExport.length} orders)`, 14, y);

    doc.save(`brend_${mode}_report_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const exportMenuBackup = async (format: "json" | "csv") => {
    if (!supabase) return;
    const { data } = await supabase.from("menus").select("*").order("category").order("name");
    if (!data) return;

    let content: string;
    let type: string;
    let ext: string;

    if (format === "json") {
      content = JSON.stringify(data, null, 2);
      type = "application/json";
      ext = "json";
    } else {
      const headers = ["id", "name", "price", "category", "image_url", "is_available"];
      const rows = data.map((item: MenuItem) =>
        headers.map((h) => String((item as unknown as Record<string, unknown>)[h] ?? "")).join(",")
      );
      content = [headers.join(","), ...rows].join("\n");
      type = "text/csv";
      ext = "csv";
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brend_menu_backup.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAuthenticated) return null;

  return (
    <Navigation>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-cafe-text font-serif mb-4">
          注文履歴
        </h2>

        {/* Filters */}
        <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4 mb-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text text-sm focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
              placeholder="日付"
            />
            <select
              value={filterStaff}
              onChange={(e) => setFilterStaff(e.target.value)}
              className="px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text text-sm focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
            >
              <option value="">全スタッフ</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={searchAmount}
              onChange={(e) => setSearchAmount(e.target.value)}
              placeholder="金額で検索"
              className="px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text text-sm focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
            />
            <button
              onClick={() => {
                setFilterDate("");
                setFilterStaff("");
                setSearchAmount("");
              }}
              className="px-3 py-2 text-cafe-text/60 hover:text-cafe-text text-sm transition-colors"
            >
              リセット
            </button>
          </div>
        </div>

        {/* Export buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => exportPDF("daily")}
            className="px-4 py-2 bg-cafe-button text-white rounded-cafe text-sm font-medium hover:bg-cafe-button/90 transition-colors"
          >
            日次PDF出力
          </button>
          <button
            onClick={() => exportPDF("monthly")}
            className="px-4 py-2 bg-cafe-button text-white rounded-cafe text-sm font-medium hover:bg-cafe-button/90 transition-colors"
          >
            月次PDF出力
          </button>
          <button
            onClick={() => exportMenuBackup("json")}
            className="px-4 py-2 bg-cafe-accent text-white rounded-cafe text-sm font-medium hover:bg-cafe-accent/90 transition-colors"
          >
            メニューJSON
          </button>
          <button
            onClick={() => exportMenuBackup("csv")}
            className="px-4 py-2 bg-cafe-accent text-white rounded-cafe text-sm font-medium hover:bg-cafe-accent/90 transition-colors"
          >
            メニューCSV
          </button>
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-cafe-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs text-cafe-text/60">
                      {order.paid_at
                        ? new Date(order.paid_at).toLocaleString("ja-JP", {
                            timeZone: "Asia/Tokyo",
                          })
                        : "-"}
                    </p>
                    <p className="text-xs text-cafe-text/60">
                      担当: {order.staffs?.name || "-"}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-cafe-accent">
                    ¥{order.total.toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {order.order_items?.map((item, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-cafe-bg text-cafe-text rounded px-2 py-0.5"
                    >
                      {item.menus?.name || "?"} x{item.quantity}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {filteredOrders.length === 0 && (
              <p className="text-cafe-text/40 text-center py-8">
                注文履歴がありません
              </p>
            )}
          </div>
        )}
      </div>
    </Navigation>
  );
}
