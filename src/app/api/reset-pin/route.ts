import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const logs: string[] = [];

  try {
    // bcryptハッシュ生成
    const hash = await bcrypt.hash("0000", 10);
    logs.push(`Generated hash: ${hash}`);

    if (!supabase) {
      logs.push("Supabase not configured");
      return NextResponse.json({ success: false, logs }, { status: 500 });
    }

    // 既存settings確認
    const { data: allSettings, error: fetchError } = await supabase
      .from("settings")
      .select("*")
      .limit(10);

    logs.push(`Fetch: ${allSettings?.length ?? 0} rows, error=${fetchError?.message || "none"}`);

    if (allSettings && allSettings.length > 0) {
      // 全行のpin_hashを更新
      for (const row of allSettings) {
        logs.push(`Updating row ${row.id}: old pin_hash="${row.pin_hash}"`);
        const { error } = await supabase
          .from("settings")
          .update({ pin_hash: hash, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        logs.push(`Update result: error=${error?.message || "none"}`);
      }
    } else {
      // 行がなければ作成
      const { error } = await supabase
        .from("settings")
        .insert({ pin_hash: hash, store_name: "Cafe BRE+ND" });
      logs.push(`Insert result: error=${error?.message || "none"}`);
    }

    // 確認: 更新後のデータ
    const { data: verify } = await supabase.from("settings").select("id, pin_hash").limit(1);
    const newHash = verify?.[0]?.pin_hash;
    logs.push(`Verify new pin_hash: "${newHash}"`);

    // 比較テスト
    if (newHash) {
      const testResult = await bcrypt.compare("0000", newHash);
      logs.push(`bcrypt.compare("0000", newHash) = ${testResult}`);
    }

    const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><title>PIN Reset</title>
<style>body{font-family:monospace;max-width:700px;margin:40px auto;padding:20px;background:#FAF6F0;color:#3E2C1C}
h1{color:#C4724E}pre{background:#FFF8F0;padding:16px;border-radius:8px;overflow-x:auto;border-left:4px solid #6B8E5A}
a{color:#5C3D2E;font-weight:bold}</style></head>
<body><h1>PIN Reset Complete</h1>
<p>PIN「0000」にリセットしました</p>
<pre>${logs.join("\n")}</pre>
<p><a href="/">→ ログイン画面へ</a></p></body></html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    logs.push(`FATAL: ${String(e)}`);
    return NextResponse.json({ success: false, logs, error: String(e) }, { status: 500 });
  }
}
