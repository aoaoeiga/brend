"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Staff } from "@/lib/types";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [pinVerified, setPinVerified] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  useEffect(() => {
    if (pinVerified && supabase) {
      supabase
        .from("staffs")
        .select("*")
        .eq("is_active", true)
        .order("name")
        .then(({ data }) => {
          if (data) setStaffList(data);
        });
    }
  }, [pinVerified]);

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
      setError("");
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError("");
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    try {
      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.success) {
        setPinVerified(true);
      } else {
        setError(data.message || "PINが正しくありません");
        setPin("");
      }
    } catch {
      setError("認証エラーが発生しました");
      setPin("");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (pin.length === 4) {
      handlePinSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const handleStaffSelect = (staff: Staff) => {
    login(staff);
    router.push("/pos");
  };

  if (!pinVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10">
        <div className="bg-cafe-card rounded-cafe-lg shadow-cafe-lg p-8 w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-cafe-text font-serif">
              Cafe BRE+ND
            </h1>
            <p className="text-cafe-text/60 mt-2 text-sm">PINコードを入力してください</p>
          </div>

          {/* PIN dots */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-colors ${
                  i < pin.length
                    ? "bg-cafe-accent border-cafe-accent"
                    : "border-cafe-text/30"
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-cafe-danger text-sm text-center mb-4">{error}</p>
          )}

          {/* Number pad */}
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handlePinInput(String(num))}
                disabled={loading}
                className="h-14 rounded-cafe bg-cafe-bg text-cafe-text text-xl font-medium hover:bg-cafe-accent/10 active:bg-cafe-accent/20 transition-colors disabled:opacity-50"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleDelete}
              disabled={loading}
              className="h-14 rounded-cafe bg-cafe-bg text-cafe-text text-sm hover:bg-cafe-danger/10 transition-colors disabled:opacity-50"
            >
              削除
            </button>
            <button
              onClick={() => handlePinInput("0")}
              disabled={loading}
              className="h-14 rounded-cafe bg-cafe-bg text-cafe-text text-xl font-medium hover:bg-cafe-accent/10 active:bg-cafe-accent/20 transition-colors disabled:opacity-50"
            >
              0
            </button>
            <div />
          </div>

          {loading && (
            <div className="flex justify-center mt-4">
              <div className="w-6 h-6 border-2 border-cafe-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Staff selection
  return (
    <div className="min-h-screen flex items-center justify-center relative z-10">
      <div className="bg-cafe-card rounded-cafe-lg shadow-cafe-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-cafe-text font-serif">
            スタッフ選択
          </h1>
          <p className="text-cafe-text/60 mt-1 text-sm">担当者を選んでください</p>
        </div>

        <div className="space-y-3">
          {staffList.map((staff) => (
            <button
              key={staff.id}
              onClick={() => handleStaffSelect(staff)}
              className="w-full py-3 px-4 bg-cafe-button text-white rounded-cafe text-lg font-medium hover:bg-cafe-button/90 active:bg-cafe-button/80 transition-colors shadow-cafe"
            >
              👤 {staff.name}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            setPinVerified(false);
            setPin("");
          }}
          className="w-full mt-4 py-2 text-cafe-text/60 text-sm hover:text-cafe-text transition-colors"
        >
          ← PINコード入力に戻る
        </button>
      </div>
    </div>
  );
}
