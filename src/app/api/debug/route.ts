import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase, getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    supabaseConfigured: !!supabase,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "NOT SET",
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "NOT SET",
  };

  try {
    const db = getSupabase();

    // settingsテーブルの中身を全取得
    const { data: allSettings, error: settingsError } = await db
      .from("settings")
      .select("*");

    debug.settingsError = settingsError?.message || null;
    debug.settingsCount = allSettings?.length ?? 0;
    debug.settingsRows = allSettings?.map((row) => ({
      id: row.id,
      pin_hash: row.pin_hash,
      pin_hash_length: row.pin_hash?.length,
      pin_hash_starts_with_$2: row.pin_hash?.startsWith("$2"),
      store_name: row.store_name,
      store_info: row.store_info,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    // bcryptテスト: "0000"のハッシュ生成と比較テスト
    const testHash = await bcrypt.hash("0000", 10);
    const testCompare = await bcrypt.compare("0000", testHash);
    debug.bcryptTest = {
      generatedHash: testHash,
      compareResult: testCompare,
    };

    // 既存のpin_hashに対して"0000"でcompareテスト
    if (allSettings && allSettings.length > 0) {
      const existingHash = allSettings[0].pin_hash;
      try {
        const compareExisting = await bcrypt.compare("0000", existingHash);
        debug.existingPinCompare = {
          hash: existingHash,
          compareWith0000: compareExisting,
        };
      } catch (e) {
        debug.existingPinCompare = {
          hash: existingHash,
          error: String(e),
        };
      }
    }

    // staffsテーブル確認
    const { data: staffs, error: staffsError } = await db
      .from("staffs")
      .select("*");
    debug.staffsError = staffsError?.message || null;
    debug.staffsCount = staffs?.length ?? 0;
    debug.staffsRows = staffs;

  } catch (e) {
    debug.fatalError = String(e);
  }

  return NextResponse.json(debug, {
    headers: { "Content-Type": "application/json" },
  });
}
