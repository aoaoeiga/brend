import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";

const DEFAULT_PIN = "0000";

export async function POST(request: NextRequest) {
  const logs: string[] = [];

  try {
    const body = await request.json();
    const pin = body?.pin;
    logs.push(`[1] Received pin: "${pin}" (length: ${pin?.length})`);

    if (!pin || pin.length !== 4) {
      logs.push("[2] Invalid pin format");
      return NextResponse.json({
        success: false,
        message: "PINは4桁で入力してください",
        _debug: logs,
      });
    }

    // --- Supabaseが未設定の場合: ハードコードフォールバック ---
    if (!supabase) {
      logs.push("[2] Supabase not configured, using hardcoded fallback");
      const success = pin === DEFAULT_PIN;
      return NextResponse.json({
        success,
        message: success ? undefined : "PINが正しくありません",
        _debug: logs,
      });
    }

    // --- Supabaseからsettings取得 ---
    logs.push("[2] Fetching settings from Supabase...");
    const { data: allSettings, error: fetchError } = await supabase
      .from("settings")
      .select("id, pin_hash")
      .limit(1);

    logs.push(`[3] Fetch result: data=${JSON.stringify(allSettings)}, error=${fetchError?.message || "none"}`);

    // Supabase fetch失敗 → フォールバック
    if (fetchError) {
      logs.push("[4] Supabase fetch failed, using hardcoded fallback");
      const success = pin === DEFAULT_PIN;
      return NextResponse.json({
        success,
        message: success ? undefined : "PINが正しくありません",
        _debug: logs,
      });
    }

    const settings = allSettings?.[0];

    // --- settingsが存在しない → 新規作成してフォールバック ---
    if (!settings) {
      logs.push("[4] No settings row found, creating one...");
      const hash = await bcrypt.hash(DEFAULT_PIN, 10);
      const { error: insertError } = await supabase
        .from("settings")
        .insert({ pin_hash: hash, store_name: "Cafe BRE+ND" });
      logs.push(`[5] Insert result: error=${insertError?.message || "none"}`);

      // 初期PIN "0000" で認証
      const success = pin === DEFAULT_PIN;
      return NextResponse.json({
        success,
        message: success ? undefined : "PINが正しくありません",
        _debug: logs,
      });
    }

    // --- pin_hashがbcryptフォーマットでない → 修復してフォールバック ---
    const pinHash = settings.pin_hash;
    logs.push(`[4] pin_hash found: "${pinHash?.substring(0, 10)}..." (length: ${pinHash?.length})`);

    if (!pinHash || !pinHash.startsWith("$2")) {
      logs.push("[5] pin_hash is NOT bcrypt format, repairing...");
      const hash = await bcrypt.hash(DEFAULT_PIN, 10);
      await supabase
        .from("settings")
        .update({ pin_hash: hash, updated_at: new Date().toISOString() })
        .eq("id", settings.id);
      logs.push("[6] Repaired. Comparing pin against DEFAULT_PIN");

      const success = pin === DEFAULT_PIN;
      return NextResponse.json({
        success,
        message: success ? undefined : "PINが正しくありません",
        _debug: logs,
      });
    }

    // --- 正常なbcryptハッシュ → bcrypt.compare ---
    logs.push("[5] pin_hash is bcrypt format, comparing...");
    const isValid = await bcrypt.compare(pin, pinHash);
    logs.push(`[6] bcrypt.compare result: ${isValid}`);

    return NextResponse.json({
      success: isValid,
      message: isValid ? undefined : "PINが正しくありません",
      _debug: logs,
    });

  } catch (e) {
    logs.push(`[ERROR] ${String(e)}`);
    // 最終フォールバック: 例外発生時でもPIN "0000" なら通す
    try {
      const body = await request.clone().json().catch(() => null);
      const pin = body?.pin;
      if (pin === DEFAULT_PIN) {
        logs.push("[FALLBACK] Exception occurred but pin matches DEFAULT_PIN, allowing");
        return NextResponse.json({ success: true, _debug: logs });
      }
    } catch {
      // ignore
    }
    return NextResponse.json({
      success: false,
      message: "認証エラーが発生しました",
      _debug: logs,
    }, { status: 500 });
  }
}
