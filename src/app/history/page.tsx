"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Navigation from "@/components/Navigation";
import { supabase } from "@/lib/supabase";
import { OrderWithItems, Staff } from "@/lib/types";

const PAGE_SIZE = 50;

export default function HistoryPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [filterStaff, setFilterStaff] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [searchAmount, setSearchAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
      return;
    }
    fetchOrders(true);
    fetchStaffs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, router]);

  const fetchStaffs = async () => {
    if (!supabase) return;
    const { data } = await supabase.from("staffs").select("*").order("name");
    if (data) setStaffList(data);
  };

  const fetchOrders = useCallback(async (reset: boolean) => {
    if (!supabase) return;
    if (reset) {
      setLoading(true);
      setOrders([]);
    } else {
      setLoadingMore(true);
    }

    const offset = reset ? 0 : orders.length;

    const { data, count } = await supabase
      .from("orders")
      .select("*, order_items(*, menus(*)), staffs(*)", { count: "exact" })
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (data) {
      const typed = data as unknown as OrderWithItems[];
      setOrders((prev) => reset ? typed : [...prev, ...typed]);
      setHasMore(typed.length === PAGE_SIZE);
    }
    if (count !== null) setTotalCount(count);

    setLoading(false);
    setLoadingMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.length]);

  const handleDeleteOrder = async (orderId: string) => {
    if (!supabase || !confirm("この注文を削除しますか？（取り消しできません）")) return;
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) {
      await supabase.from("order_items").delete().eq("order_id", orderId);
      await supabase.from("orders").delete().eq("id", orderId);
    }
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    if (totalCount !== null) setTotalCount(totalCount - 1);
  };

  const filteredOrders = orders.filter((order) => {
    if (filterStaff && order.staff_id !== filterStaff) return false;
    if (filterDate && (order.paid_at || order.created_at)) {
      const ts = order.paid_at || order.created_at;
      const orderDate = new Date(ts).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
      const filterParts = filterDate.split("-");
      const formatted = `${Number(filterParts[0])}/${Number(filterParts[1])}/${Number(filterParts[2])}`;
      if (orderDate !== formatted) return false;
    }
    if (searchAmount && !String(order.total).includes(searchAmount)) return false;
    return true;
  });

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

        <p className="text-sm text-cafe-text/60 mb-3">
          {filteredOrders.length}件表示{totalCount !== null ? ` / 全${totalCount}件` : ""}
        </p>

        {/* Orders list */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-cafe-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-xs text-cafe-text/60">
                        {(order.paid_at || order.created_at)
                          ? new Date(order.paid_at || order.created_at).toLocaleString("ja-JP", {
                              timeZone: "Asia/Tokyo",
                            })
                          : "-"}
                      </p>
                      <p className="text-xs text-cafe-text/60">
                        担当: {order.staffs?.name || "-"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-bold text-cafe-accent">
                        ¥{order.total.toLocaleString()}
                      </p>
                      <button
                        onClick={() => handleDeleteOrder(order.id)}
                        className="px-2 py-1 bg-cafe-danger/10 text-cafe-danger rounded text-xs font-medium hover:bg-cafe-danger/20 transition-colors"
                      >
                        削除
                      </button>
                    </div>
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

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => fetchOrders(false)}
                  disabled={loadingMore}
                  className="px-6 py-2 bg-cafe-button text-white rounded-cafe font-medium hover:bg-cafe-button/90 disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? "読み込み中..." : "もっと読み込む"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Navigation>
  );
}
