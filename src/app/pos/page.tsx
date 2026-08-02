"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Navigation from "@/components/Navigation";
import { supabase } from "@/lib/supabase";
import { MenuItem, CartItem, CATEGORY_LABELS, CATEGORY_EMOJI } from "@/lib/types";

export default function POSPage() {
  const { isAuthenticated, currentStaff } = useAuth();
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState("all");
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ id: string; total: number; items: CartItem[]; paidAt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
      return;
    }
    fetchMenu();
  }, [isAuthenticated, router]);

  const fetchMenu = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("menus")
      .select("*")
      .eq("is_available", true)
      .order("category")
      .order("name");
    if (data) setMenuItems(data);
  };

  const addToCart = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menu.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menu: item, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((menuId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((c) =>
          c.menu.id === menuId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0);
    });
  }, []);

  const total = cart.reduce((sum, item) => sum + item.menu.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (!supabase || !currentStaff || cart.length === 0) return;
    setLoading(true);
    try {
      const paidAt = new Date().toISOString();
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          total,
          staff_id: currentStaff.id,
          status: "paid",
          paid_at: paidAt,
        })
        .select()
        .single();

      if (orderError || !order) throw orderError;

      const orderItems = cart.map((item) => ({
        order_id: order.id,
        menu_id: item.menu.id,
        quantity: item.quantity,
        subtotal: item.menu.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      setLastOrder({ id: order.id, total, items: [...cart], paidAt });
      setCart([]);
      setShowReceipt(true);
      setShowCart(false);
    } catch (err) {
      console.error("Checkout error:", err);
      setToast({ message: "保存できませんでした。もう一度お試しください。", type: "error" });
      setTimeout(() => setToast(null), 4000);
    }
    setLoading(false);
  };

  const filteredItems =
    category === "all"
      ? menuItems
      : menuItems.filter((item) => item.category === category);

  if (!isAuthenticated) return null;

  return (
    <Navigation>
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-cafe shadow-cafe-lg text-white font-medium text-sm animate-pulse ${
          toast.type === "error" ? "bg-cafe-danger" : "bg-cafe-success"
        }`}>
          {toast.message}
        </div>
      )}
      <div className="flex flex-col md:flex-row h-full">
        {/* Menu area */}
        <div className="flex-1 p-4 overflow-auto">
          <h2 className="text-2xl font-bold text-cafe-text font-serif mb-4">
            注文
          </h2>

          {/* Category filter */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={`px-4 py-2 rounded-cafe text-sm whitespace-nowrap transition-colors ${
                  category === key
                    ? "bg-cafe-button text-white"
                    : "bg-cafe-card text-cafe-text hover:bg-cafe-accent/10 border border-cafe-accent/20"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Menu grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="bg-cafe-card rounded-cafe-lg shadow-cafe p-3 text-left hover:shadow-cafe-lg transition-shadow active:scale-[0.98]"
              >
                <div className="w-full aspect-square rounded-cafe bg-cafe-bg flex items-center justify-center mb-2 overflow-hidden">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover rounded-cafe"
                    />
                  ) : (
                    <span className="text-4xl">
                      {CATEGORY_EMOJI[item.category] || "☕"}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-cafe-text truncate">
                  {item.name}
                </p>
                <p className="text-cafe-accent font-bold">
                  ¥{item.price.toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Cart sidebar (PC) */}
        <div className="hidden md:flex flex-col w-80 bg-cafe-card border-l border-cafe-accent/20 shadow-cafe">
          <div className="p-4 border-b border-cafe-accent/20">
            <h3 className="text-lg font-bold text-cafe-text font-serif">
              カート
            </h3>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {cart.length === 0 ? (
              <p className="text-cafe-text/40 text-center mt-8">
                商品をタップして追加
              </p>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.menu.id}
                    className="flex items-center justify-between bg-cafe-bg rounded-cafe p-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-cafe-text truncate">
                        {item.menu.name}
                      </p>
                      <p className="text-xs text-cafe-text/60">
                        ¥{item.menu.price.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.menu.id, -1)}
                        className="w-7 h-7 rounded-full bg-cafe-danger/10 text-cafe-danger flex items-center justify-center text-sm font-bold"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-bold text-cafe-text">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.menu.id, 1)}
                        className="w-7 h-7 rounded-full bg-cafe-success/10 text-cafe-success flex items-center justify-center text-sm font-bold"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-sm font-bold text-cafe-text ml-2 w-16 text-right">
                      ¥{(item.menu.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 border-t border-cafe-accent/20">
            <div className="flex justify-between items-center mb-3">
              <span className="text-lg font-bold text-cafe-text">合計</span>
              <span className="text-2xl font-bold text-cafe-accent">
                ¥{total.toLocaleString()}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || loading}
              className="w-full py-3 bg-cafe-success text-white rounded-cafe font-bold text-lg hover:bg-cafe-success/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "処理中..." : "会計確定"}
            </button>
          </div>
        </div>

        {/* Mobile cart button */}
        {cart.length > 0 && !showCart && (
          <button
            onClick={() => setShowCart(true)}
            className="md:hidden fixed bottom-16 right-4 bg-cafe-success text-white rounded-full px-6 py-3 shadow-cafe-lg z-40 font-bold"
          >
            {cart.reduce((s, c) => s + c.quantity, 0)}点 ¥{total.toLocaleString()}
          </button>
        )}

        {/* Mobile cart sheet */}
        {showCart && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col">
            <div
              className="flex-1 bg-black/30"
              onClick={() => setShowCart(false)}
            />
            <div className="bg-cafe-card rounded-t-2xl p-4 max-h-[70vh] flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold text-cafe-text font-serif">
                  カート
                </h3>
                <button
                  onClick={() => setShowCart(false)}
                  className="text-cafe-text/60 text-xl"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-auto space-y-2 mb-3">
                {cart.map((item) => (
                  <div
                    key={item.menu.id}
                    className="flex items-center justify-between bg-cafe-bg rounded-cafe p-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-cafe-text truncate">
                        {item.menu.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.menu.id, -1)}
                        className="w-7 h-7 rounded-full bg-cafe-danger/10 text-cafe-danger flex items-center justify-center text-sm font-bold"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-bold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.menu.id, 1)}
                        className="w-7 h-7 rounded-full bg-cafe-success/10 text-cafe-success flex items-center justify-center text-sm font-bold"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-sm font-bold text-cafe-text ml-2">
                      ¥{(item.menu.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-lg font-bold text-cafe-text">合計</span>
                <span className="text-2xl font-bold text-cafe-accent">
                  ¥{total.toLocaleString()}
                </span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full py-3 bg-cafe-success text-white rounded-cafe font-bold text-lg disabled:opacity-50 transition-colors"
              >
                {loading ? "処理中..." : "会計確定"}
              </button>
            </div>
          </div>
        )}

        {/* Receipt modal - simplified, no print */}
        {showReceipt && lastOrder && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-cafe-lg shadow-cafe-lg max-w-sm w-full max-h-[90vh] overflow-auto">
              <div className="p-6">
                <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4">
                  <h2 className="text-xl font-bold font-serif text-cafe-text">
                    Cafe BRE+ND
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">会計完了</p>
                  <p className="text-xs text-gray-500">
                    {new Date(lastOrder.paidAt).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                    })}
                  </p>
                  <p className="text-xs text-gray-500">
                    担当: {currentStaff?.name}
                  </p>
                </div>

                <div className="space-y-2 border-b border-dashed border-gray-300 pb-4 mb-4">
                  {lastOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="flex-1">
                        {item.menu.name} x{item.quantity}
                      </span>
                      <span className="font-medium">
                        ¥{(item.menu.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-bold text-cafe-text">
                    合計（税込）
                  </span>
                  <span className="text-2xl font-bold text-cafe-accent">
                    ¥{lastOrder.total.toLocaleString()}
                  </span>
                </div>

                <p className="text-center text-xs text-gray-400">
                  注文番号: {lastOrder.id.slice(0, 8).toUpperCase()}
                </p>
              </div>

              <div className="p-4 border-t">
                <button
                  onClick={() => {
                    setShowReceipt(false);
                    setLastOrder(null);
                  }}
                  className="w-full py-2 bg-cafe-button text-white rounded-cafe font-medium transition-colors hover:bg-cafe-button/90"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Navigation>
  );
}
