"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Navigation from "@/components/Navigation";
import { supabase } from "@/lib/supabase";
import { Staff, Settings } from "@/lib/types";

export default function SettingsPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [newStaffName, setNewStaffName] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinMessage, setPinMessage] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeInfo, setStoreInfo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
      return;
    }
    fetchData();
  }, [isAuthenticated, router]);

  const fetchData = async () => {
    if (!supabase) return;
    const [staffRes, settingsRes] = await Promise.all([
      supabase.from("staffs").select("*").order("name"),
      supabase.from("settings").select("*").limit(1).single(),
    ]);
    if (staffRes.data) setStaffList(staffRes.data);
    if (settingsRes.data) {
      setSettings(settingsRes.data);
      setStoreName(settingsRes.data.store_name || "");
      setStoreInfo(settingsRes.data.store_info || "");
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinMessage("PINは4桁の数字で入力してください");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json();
      setPinMessage(data.success ? "PINを変更しました" : data.message);
      if (data.success) {
        setCurrentPin("");
        setNewPin("");
      }
    } catch {
      setPinMessage("エラーが発生しました");
    }
    setSaving(false);
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !newStaffName.trim()) return;
    await supabase.from("staffs").insert({ name: newStaffName.trim(), is_active: true });
    setNewStaffName("");
    fetchData();
  };

  const toggleStaff = async (staff: Staff) => {
    if (!supabase) return;
    await supabase
      .from("staffs")
      .update({ is_active: !staff.is_active })
      .eq("id", staff.id);
    fetchData();
  };

  const deleteStaff = async (id: string) => {
    if (!supabase || !confirm("このスタッフを削除しますか？")) return;
    await supabase.from("staffs").delete().eq("id", id);
    fetchData();
  };

  const handleSaveStoreInfo = async () => {
    if (!supabase || !settings) return;
    setSaving(true);
    await supabase
      .from("settings")
      .update({
        store_name: storeName,
        store_info: storeInfo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id);
    setSaving(false);
    alert("店舗情報を保存しました");
  };

  if (!isAuthenticated) return null;

  return (
    <Navigation>
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-cafe-text font-serif mb-6">
          設定
        </h2>

        {/* PIN Change */}
        <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4 mb-6">
          <h3 className="text-lg font-bold text-cafe-text font-serif mb-3">
            PINコード変更
          </h3>
          <form onSubmit={handleChangePin} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-cafe-text mb-1">
                現在のPIN
              </label>
              <input
                type="password"
                maxLength={4}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                required
                className="w-full px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
                placeholder="4桁の数字"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-cafe-text mb-1">
                新しいPIN
              </label>
              <input
                type="password"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                required
                className="w-full px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
                placeholder="4桁の数字"
              />
            </div>
            {pinMessage && (
              <p className={`text-sm ${pinMessage.includes("変更しました") ? "text-cafe-success" : "text-cafe-danger"}`}>
                {pinMessage}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 bg-cafe-button text-white rounded-cafe font-medium disabled:opacity-50 hover:bg-cafe-button/90 transition-colors"
            >
              PINを変更
            </button>
          </form>
        </div>

        {/* Staff Management */}
        <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4 mb-6">
          <h3 className="text-lg font-bold text-cafe-text font-serif mb-3">
            スタッフ管理
          </h3>
          <form onSubmit={handleAddStaff} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              placeholder="スタッフ名"
              className="flex-1 px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text text-sm focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-cafe-success text-white rounded-cafe text-sm font-medium hover:bg-cafe-success/90 transition-colors"
            >
              追加
            </button>
          </form>
          <div className="space-y-2">
            {staffList.map((staff) => (
              <div
                key={staff.id}
                className={`flex items-center justify-between bg-cafe-bg rounded-cafe p-3 ${
                  !staff.is_active ? "opacity-50" : ""
                }`}
              >
                <span className="text-sm font-medium text-cafe-text">
                  👤 {staff.name}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleStaff(staff)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      staff.is_active
                        ? "bg-cafe-success/10 text-cafe-success"
                        : "bg-cafe-danger/10 text-cafe-danger"
                    }`}
                  >
                    {staff.is_active ? "有効" : "無効"}
                  </button>
                  <button
                    onClick={() => deleteStaff(staff.id)}
                    className="px-2 py-1 bg-cafe-danger/10 text-cafe-danger rounded text-xs font-medium hover:bg-cafe-danger/20 transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Store info */}
        <div className="bg-cafe-card rounded-cafe-lg shadow-cafe p-4">
          <h3 className="text-lg font-bold text-cafe-text font-serif mb-3">
            店舗情報
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-cafe-text mb-1">
                店舗名
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text focus:outline-none focus:ring-2 focus:ring-cafe-accent/40"
                placeholder="Cafe BRE+ND"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-cafe-text mb-1">
                店舗情報（住所等）
              </label>
              <textarea
                value={storeInfo}
                onChange={(e) => setStoreInfo(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-cafe-accent/20 rounded-cafe bg-white text-cafe-text focus:outline-none focus:ring-2 focus:ring-cafe-accent/40 resize-none"
                placeholder="住所・電話番号等"
              />
            </div>
            <button
              onClick={handleSaveStoreInfo}
              disabled={saving}
              className="w-full py-2 bg-cafe-button text-white rounded-cafe font-medium disabled:opacity-50 hover:bg-cafe-button/90 transition-colors"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </Navigation>
  );
}
