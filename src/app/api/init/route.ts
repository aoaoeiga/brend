import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DEFAULT_PIN = "0000";

export async function GET() {
  try {
    const supabase = getSupabase();
    const hash = await bcrypt.hash(DEFAULT_PIN, 10);
    const results: string[] = [];

    // --- settings: pin_hashを正しいbcryptハッシュで upsert ---
    const { data: existing } = await supabase
      .from("settings")
      .select("id, pin_hash")
      .limit(1)
      .single();

    if (existing) {
      // 既存行のpin_hashが正しいbcryptかチェック
      let isValid = false;
      try {
        isValid = await bcrypt.compare(DEFAULT_PIN, existing.pin_hash);
      } catch {
        isValid = false;
      }

      if (!isValid) {
        const { error } = await supabase
          .from("settings")
          .update({ pin_hash: hash, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        results.push(error ? `settings更新失敗: ${error.message}` : "settings: pin_hashを修正しました");
      } else {
        results.push("settings: pin_hashは正常です（変更なし）");
      }
    } else {
      const { error } = await supabase
        .from("settings")
        .insert({ pin_hash: hash, store_name: "Cafe BRE+ND" });
      results.push(error ? `settings作成失敗: ${error.message}` : "settings: 初期データを作成しました");
    }

    // --- staffs: なければデフォルト2名を追加 ---
    const { data: staffs } = await supabase.from("staffs").select("id");
    if (!staffs || staffs.length === 0) {
      const { error } = await supabase
        .from("staffs")
        .insert([
          { name: "スタッフ1", is_active: true },
          { name: "スタッフ2", is_active: true },
        ]);
      results.push(error ? `staffs作成失敗: ${error.message}` : "staffs: デフォルト2名を作成しました");
    } else {
      results.push(`staffs: ${staffs.length}名が存在します（変更なし）`);
    }

    // レスポンスをHTMLで返す（ブラウザで見やすく）
    const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><title>Cafe BRE+ND 初期化</title>
<style>body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px;background:#FAF6F0;color:#3E2C1C}
h1{color:#C4724E}li{margin:8px 0;padding:8px;background:#FFF8F0;border-radius:8px;border-left:4px solid #6B8E5A}
a{color:#5C3D2E;font-weight:bold}</style></head>
<body><h1>Cafe BRE+ND 初期化完了</h1>
<p>初期PIN: <strong>0000</strong></p>
<ul>${results.map((r) => `<li>${r}</li>`).join("")}</ul>
<p><a href="/">→ ログイン画面へ</a></p></body></html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: "初期化エラー", error: String(e) },
      { status: 500 }
    );
  }
}
