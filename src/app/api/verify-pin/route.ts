import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabase } from "@/lib/supabase";

const DEFAULT_PIN = "0000";

async function ensureSettings(supabase: ReturnType<typeof getSupabase>) {
  const { data, error } = await supabase
    .from("settings")
    .select("id, pin_hash")
    .limit(1)
    .single();

  // 行が存在し、pin_hashがbcryptフォーマット($2a$/$2b$で始まる)ならそのまま返す
  if (data && data.pin_hash && data.pin_hash.startsWith("$2")) {
    return data;
  }

  // 行が存在するがpin_hashが不正 → 正しいハッシュで更新
  if (data) {
    const hash = await bcrypt.hash(DEFAULT_PIN, 10);
    const { error: updateError } = await supabase
      .from("settings")
      .update({ pin_hash: hash, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (updateError) return null;
    return { ...data, pin_hash: hash };
  }

  // 行が存在しない(PGRST116) → 新規作成
  if (error && error.code === "PGRST116") {
    const hash = await bcrypt.hash(DEFAULT_PIN, 10);
    const { data: created, error: insertError } = await supabase
      .from("settings")
      .insert({ pin_hash: hash, store_name: "Cafe BRE+ND" })
      .select("id, pin_hash")
      .single();
    if (insertError) return null;
    return created;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json();
    const supabase = getSupabase();

    const settings = await ensureSettings(supabase);

    if (!settings) {
      return NextResponse.json({ success: false, message: "設定が見つかりません" }, { status: 500 });
    }

    const isValid = await bcrypt.compare(pin, settings.pin_hash);

    if (isValid) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, message: "PINが正しくありません" });
    }
  } catch {
    return NextResponse.json({ success: false, message: "認証エラーが発生しました" }, { status: 500 });
  }
}
