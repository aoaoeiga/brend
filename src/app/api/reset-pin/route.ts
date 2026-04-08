import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabase } from "@/lib/supabase";

export async function POST() {
  try {
    const supabase = getSupabase();
    const hash = await bcrypt.hash("0000", 10);

    // 既存のsettingsがあれば更新、なければ作成
    const { data: existing } = await supabase
      .from("settings")
      .select("id")
      .limit(1)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("settings")
        .update({ pin_hash: hash, updated_at: new Date().toISOString() })
        .eq("id", existing.id);

      if (error) {
        return NextResponse.json({ success: false, message: "更新に失敗しました", error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabase
        .from("settings")
        .insert({ pin_hash: hash, store_name: "Cafe BRE+ND" });

      if (error) {
        return NextResponse.json({ success: false, message: "作成に失敗しました", error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: "PINを「0000」にリセットしました" });
  } catch {
    return NextResponse.json({ success: false, message: "エラーが発生しました" }, { status: 500 });
  }
}
