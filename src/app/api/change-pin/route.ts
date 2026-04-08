import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { currentPin, newPin } = await request.json();
    const supabase = getSupabase();

    const { data: settings, error: fetchError } = await supabase
      .from("settings")
      .select("id, pin_hash")
      .limit(1)
      .single();

    if (fetchError || !settings) {
      return NextResponse.json({ success: false, message: "設定が見つかりません" }, { status: 500 });
    }

    const isValid = await bcrypt.compare(currentPin, settings.pin_hash);
    if (!isValid) {
      return NextResponse.json({ success: false, message: "現在のPINが正しくありません" });
    }

    const newHash = await bcrypt.hash(newPin, 10);
    const { error: updateError } = await supabase
      .from("settings")
      .update({ pin_hash: newHash, updated_at: new Date().toISOString() })
      .eq("id", settings.id);

    if (updateError) {
      return NextResponse.json({ success: false, message: "PIN更新に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "エラーが発生しました" }, { status: 500 });
  }
}
