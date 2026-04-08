"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Navigation from "@/components/Navigation";
import { supabase } from "@/lib/supabase";
import { MenuItem, CATEGORY_LABELS, CATEGORY_EMOJI } from "@/lib/types";

export default function MenuPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState({
    name: "",
    price: "",
    category: "fast_coffee",
    image_url: "",
    cost_rate: "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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
      .order("category")
      .order("name");
    if (data) setMenuItems(data);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("menu-images")
      .upload(fileName, file);
    if (!error) {
      const { data: urlData } = supabase.storage
        .from("menu-images")
        .getPublicUrl(fileName);
      setForm((prev) => ({ ...prev, image_url: urlData.publicUrl }));
    }
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);

    const payload: Record<string, unknown> = {
      name: form.name,
      price: parseInt(form.price),
      category: form.category,
      image_url: form.image_url || null,
    };

    // cost_rateカラムがあれば設定（なければSupabaseが無視する）
    if (form.cost_rate !== "") {
      payload.cost_rate = parseInt(form.cost_rate);
    }

    if (editingItem) {
      await supabase.from("menus").update(payload).eq("id", editingItem.id);
    } else {
      await supabase.from("menus").insert({ ...payload, is_available: true });
    }

    resetForm();
    fetchMenu();
    setSaving(false);
  };

  const resetForm = () => {
    setForm({ name: "", price: "", category: "fast_coffee", image_url: "", cost_rate: "" });
    setEditingItem(null);
    setShowForm(false);
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      price: String(item.price),
      category: item.category,
      image_url: item.image_url || "",
      cost_rate: item.cost_rate != null ? String(item.cost_rate) : "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!supabase || !confirm("この商品を削除しますか？")) return;
    await supabase.from("menus").delete().eq("id", id);
    fetchMenu();
  };

  const toggleAvailability = async (item: MenuItem) => {
    if (!supabase) return;
    await supabase
      .from("menus")
      .update({ is_available: !item.is_available })
      .eq("id", item.id);
    fetchMenu();
  };

  const categories = ["fast_coffee", "drip_coffee", "other_drinks", "food"];

  if (!isAuthenticated) return null;

  return (
    <Navigation>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-cafe-text font-serif">
            メニュー管理
          </h2>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-4 py-2 bg-cafe-success text-white rounded-cafe font-medium hover:bg-cafe-success/90 transition-colors"
          >
            ＋ 新規追加
          </button>
        </div>

        {/* Form modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-cafe-card rounded-cafe-lg shadow-cafe-lg w-full max-w-md p-6">
              <h3 className="text-lg font-bold text-cafe-text font-serif mb-4">
                {editingItem ? "メニュー編集" : "メニュー追加"}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-cafe-text mb-1">
                    商品名
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    required
                    className="w-full px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-cafe-text mb-1">
                      価格（税込・円）
                    </label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, price: e.target.value }))
                      }
                      required
                      min="0"
                      className="w-full px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-cafe-text mb-1">
                      原価率（%）
                    </label>
                    <input
                      type="number"
                      value={form.cost_rate}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, cost_rate: e.target.value }))
                      }
                      min="0"
                      max="100"
                      placeholder="例: 30"
                      className="w-full px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-cafe-text mb-1">
                    カテゴリ
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, category: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-cafe-text mb-1">
                    画像
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full text-sm text-cafe-text"
                  />
                  {uploading && (
                    <p className="text-xs text-cafe-accent mt-1">
                      アップロード中...
                    </p>
                  )}
                  {form.image_url && (
                    <p className="text-xs text-cafe-success mt-1">
                      画像がアップロードされました
                    </p>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2 bg-cafe-button text-white rounded-cafe font-medium disabled:opacity-50 transition-colors hover:bg-cafe-button/90"
                  >
                    {saving ? "保存中..." : "保存"}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-2 bg-cafe-bg text-cafe-text rounded-cafe font-medium border border-cafe-accent/20 hover:bg-cafe-accent/10 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Menu list by category */}
        {categories.map((cat) => {
          const items = menuItems.filter((item) => item.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mb-6">
              <h3 className="text-lg font-bold text-cafe-text font-serif mb-3">
                {CATEGORY_EMOJI[cat]} {CATEGORY_LABELS[cat]}
              </h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 bg-cafe-card rounded-cafe shadow-cafe p-3 ${
                      !item.is_available ? "opacity-50" : ""
                    }`}
                  >
                    <div className="w-12 h-12 rounded-cafe bg-cafe-bg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">
                          {CATEGORY_EMOJI[item.category] || "☕"}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-cafe-text truncate">
                        {item.name}
                      </p>
                      <div className="flex gap-2 items-center">
                        <p className="text-sm text-cafe-accent font-bold">
                          ¥{item.price.toLocaleString()}
                        </p>
                        {item.cost_rate != null && (
                          <p className="text-xs text-cafe-text/50">
                            原価率{item.cost_rate}%
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleAvailability(item)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          item.is_available
                            ? "bg-cafe-success/10 text-cafe-success"
                            : "bg-cafe-danger/10 text-cafe-danger"
                        }`}
                      >
                        {item.is_available ? "販売中" : "品切れ"}
                      </button>
                      <button
                        onClick={() => handleEdit(item)}
                        className="px-2 py-1 bg-cafe-accent/10 text-cafe-accent rounded text-xs font-medium hover:bg-cafe-accent/20 transition-colors"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-2 py-1 bg-cafe-danger/10 text-cafe-danger rounded text-xs font-medium hover:bg-cafe-danger/20 transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Navigation>
  );
}
