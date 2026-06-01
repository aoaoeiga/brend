import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { MonthlyReport, ReportSection, ReportCell } from "@/lib/report-data";

/**
 * 月次報告書の Excel(.xlsx) / PDF(.pdf) 出力モジュール。
 */

const TITLE = "Cafe BRE+ND 月次営業報告書";
const FOOTER_NOTE = "本報告書は会計補助資料です。原価は商品別原価率(cost_rate)に基づく推計値を含みます。";

// デザインカラー
const C = {
  header: "5C3D2E", // ヘッダー背景
  section: "3E2C1C", // セクションヘッダー背景
  altRow: "FFF8F0", // 交互行
  pos: "1D9E75", // プラス（緑）
  neg: "A32D2D", // マイナス（赤）
  white: "FFFFFF",
  text: "3E2C1C",
};

// hex -> [r,g,b]
const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(0, 2), 16),
  parseInt(hex.slice(2, 4), 16),
  parseInt(hex.slice(4, 6), 16),
];

const fileBase = (r: MonthlyReport) => `cafe-brend-月次報告書-${r.year}年${r.month}月`;

// ============================================================
// Excel 出力
// ============================================================

export function downloadExcel(report: MonthlyReport): void {
  const COLS = 6; // 最大列数（商品別実績）
  const aoa: (string | number)[][] = [];
  const styles: (Record<string, unknown> | null)[][] = [];
  const merges: XLSX.Range[] = [];

  const pushRow = (values: (string | number)[], rowStyles: (Record<string, unknown> | null)[]) => {
    const v = [...values];
    const s = [...rowStyles];
    while (v.length < COLS) {
      v.push("");
      s.push(null);
    }
    aoa.push(v);
    styles.push(s);
  };

  const border = {
    top: { style: "thin", color: { rgb: "E5D9C8" } },
    bottom: { style: "thin", color: { rgb: "E5D9C8" } },
    left: { style: "thin", color: { rgb: "E5D9C8" } },
    right: { style: "thin", color: { rgb: "E5D9C8" } },
  };

  const titleStyle = {
    font: { bold: true, sz: 16, color: { rgb: C.white } },
    fill: { fgColor: { rgb: C.header } },
    alignment: { horizontal: "center", vertical: "center" },
  };
  const subtitleStyle = {
    font: { bold: false, sz: 10, color: { rgb: C.white } },
    fill: { fgColor: { rgb: C.header } },
    alignment: { horizontal: "center", vertical: "center" },
  };
  const sectionStyle = {
    font: { bold: true, sz: 12, color: { rgb: C.white } },
    fill: { fgColor: { rgb: C.section } },
    alignment: { horizontal: "left", vertical: "center" },
  };
  const colHeaderStyle = {
    font: { bold: true, sz: 10, color: { rgb: C.white } },
    fill: { fgColor: { rgb: C.header } },
    alignment: { horizontal: "center", vertical: "center" },
    border,
  };
  const footerStyle = {
    font: { italic: true, sz: 9, color: { rgb: "8A7A6A" } },
    alignment: { horizontal: "left", vertical: "center" },
  };

  const dataCellStyle = (cell: ReportCell, altRow: boolean): Record<string, unknown> => {
    const color = cell.delta === "pos" ? C.pos : cell.delta === "neg" ? C.neg : C.text;
    return {
      font: { sz: 10, color: { rgb: color }, bold: cell.delta ? true : false },
      fill: altRow ? { fgColor: { rgb: C.altRow } } : { fgColor: { rgb: C.white } },
      alignment: { horizontal: cell.align || "left", vertical: "center" },
      border,
    };
  };

  // タイトル
  pushRow([TITLE], [titleStyle]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } });
  pushRow([`対象月: ${report.label}　／　出力日: ${report.generatedAt}`], [subtitleStyle]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } });
  pushRow([""], [null]); // 空行

  // 各セクション
  report.sections.forEach((section: ReportSection) => {
    const r0 = aoa.length;
    pushRow([section.title], [sectionStyle]);
    merges.push({ s: { r: r0, c: 0 }, e: { r: r0, c: COLS - 1 } });

    pushRow(
      section.columns,
      section.columns.map(() => colHeaderStyle)
    );

    section.rows.forEach((row, idx) => {
      const alt = idx % 2 === 1;
      pushRow(
        row.map((c) => c.value),
        row.map((c) => dataCellStyle(c, alt))
      );
    });

    pushRow([""], [null]); // セクション間の空行
  });

  // フッター
  pushRow([`出力日: ${report.generatedAt}`], [footerStyle]);
  merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: COLS - 1 } });
  pushRow([FOOTER_NOTE], [footerStyle]);
  merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: COLS - 1 } });

  // ワークシート生成
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (let r = 0; r < styles.length; r++) {
    for (let c = 0; c < COLS; c++) {
      const st = styles[r]?.[c];
      if (!st) continue;
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "s", v: "" };
      ws[addr].s = st;
    }
  }
  ws["!merges"] = merges;
  ws["!cols"] = [{ wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "月次報告書");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `${fileBase(report)}.xlsx`);
}

// ============================================================
// PDF 出力
// ============================================================

const FONT_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sawarabigothic/SawarabiGothic-Regular.ttf";
const FONT_NAME = "SawarabiGothic";
let cachedFontBase64: string | null = null;

async function loadJapaneseFont(): Promise<string> {
  if (cachedFontBase64) return cachedFontBase64;
  const res = await fetch(FONT_URL);
  if (!res.ok) throw new Error("日本語フォントの取得に失敗しました。");
  const buf = await res.arrayBuffer();
  // ArrayBuffer -> base64
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  cachedFontBase64 = btoa(binary);
  return cachedFontBase64;
}

export async function downloadPdf(report: MonthlyReport): Promise<void> {
  const fontBase64 = await loadJapaneseFont();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.addFileToVFS(`${FONT_NAME}.ttf`, fontBase64);
  doc.addFont(`${FONT_NAME}.ttf`, FONT_NAME, "normal");
  doc.setFont(FONT_NAME);

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;

  // ヘッダーバンド
  const headerH = 22;
  doc.setFillColor(...rgb(C.header));
  doc.rect(0, 0, pageW, headerH, "F");
  doc.setTextColor(...rgb(C.white));
  doc.setFontSize(16);
  doc.text(TITLE, pageW / 2, 11, { align: "center" });
  doc.setFontSize(9);
  doc.text(`対象月: ${report.label}　／　出力日: ${report.generatedAt}`, pageW / 2, 18, { align: "center" });

  let cursorY = headerH + 6;

  report.sections.forEach((section: ReportSection) => {
    // セクションタイトル
    doc.setFont(FONT_NAME);
    doc.setFontSize(11);
    doc.setTextColor(...rgb(C.section));
    doc.text(section.title, margin, cursorY);
    cursorY += 2;

    // 列ごとの配置（先頭=左、以降=右）
    const columnStyles: Record<number, { halign: "left" | "right" | "center" }> = {};
    section.columns.forEach((_, i) => {
      columnStyles[i] = { halign: i === 0 ? "left" : "right" };
    });

    autoTable(doc, {
      startY: cursorY,
      head: [section.columns],
      body: section.rows.map((row) => row.map((c) => String(c.value))),
      margin: { left: margin, right: margin },
      styles: { font: FONT_NAME, fontSize: 8.5, cellPadding: 1.6, textColor: rgb(C.text), lineColor: rgb("E5D9C8"), lineWidth: 0.1 },
      headStyles: { font: FONT_NAME, fillColor: rgb(C.header), textColor: rgb(C.white), fontStyle: "normal", halign: "center" },
      alternateRowStyles: { fillColor: rgb(C.altRow) },
      columnStyles,
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const t = String(data.cell.raw ?? "");
        if (t.startsWith("+")) data.cell.styles.textColor = rgb(C.pos);
        else if (t.startsWith("-") && t.length > 1) data.cell.styles.textColor = rgb(C.neg);
      },
      didDrawPage: () => {
        // フッター
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFont(FONT_NAME);
        doc.setFontSize(7.5);
        doc.setTextColor(138, 122, 106);
        doc.text(`出力日: ${report.generatedAt}`, margin, pageH - 8);
        doc.text(FOOTER_NOTE, margin, pageH - 4.5);
        const page = doc.getNumberOfPages();
        doc.text(`${page}`, pageW - margin, pageH - 4.5, { align: "right" });
      },
    });

    // 次のセクション開始位置
    // @ts-expect-error lastAutoTable は jspdf-autotable が付与する
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 8;
  });

  const blob = doc.output("blob");
  saveAs(blob, `${fileBase(report)}.pdf`);
}
