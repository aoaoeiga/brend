import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json();
    const supabase = getSupabase();

    const { data: settings, error } = await supabase
      .from("settings")
      .select("pin_hash")
      .limit(1)
      .single();

    if (error || !settings) {
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
