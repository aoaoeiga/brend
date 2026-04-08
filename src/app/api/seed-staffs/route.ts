import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const STAFF_NAMES = ["1", "2", "3", "4", "5", "6", "開発者"];

export async function GET() {
  try {
    const supabase = getSupabase();

    // 既存スタッフを全削除
    const { error: deleteError } = await supabase
      .from("staffs")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // 全行削除のためダミー条件

    if (deleteError) {
      return NextResponse.json({ success: false, message: "削除失敗", error: deleteError.message }, { status: 500 });
    }

    // 7名を追加
    const { data, error: insertError } = await supabase
      .from("staffs")
      .insert(STAFF_NAMES.map((name) => ({ name, is_active: true })))
      .select();

    if (insertError) {
      return NextResponse.json({ success: false, message: "追加失敗", error: insertError.message }, { status: 500 });
    }

    const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><title>スタッフ登録</title>
<style>body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px;background:#FAF6F0;color:#3E2C1C}
h1{color:#C4724E}li{margin:8px 0;padding:8px;background:#FFF8F0;border-radius:8px;border-left:4px solid #6B8E5A}
a{color:#5C3D2E;font-weight:bold}</style></head>
<body><h1>スタッフ登録完了</h1>
<p>${data?.length ?? 0}名を登録しました</p>
<ul>${(data ?? []).map((s) => `<li>👤 ${s.name} (${s.id.slice(0, 8)})</li>`).join("")}</ul>
<p><a href="/">→ ログイン画面へ</a></p></body></html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: "エラー", error: String(e) }, { status: 500 });
  }
}
