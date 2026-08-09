/* =====================================================================
 * Excel 處理（SheetJS）：模板生成、上傳解析、結果匯出 —— 純瀏覽器端
 *  v2: 新增「指定日期」欄位（每列可不同）、客戶編號改選填
 * ===================================================================== */
"use strict";

const EXCEL_HEADERS = ["客戶編號", "指定日期", "市場", "股票代碼", "股份數量"];

/* 將儲存格值標準化為 YYYY-MM-DD；不認得則回傳 null（呼叫端退回批量預設日期） */
function parseCellDate(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  // Excel 日期序號：自 1900-01-01 起的天數（僅當明確為數字時生效）
  if (typeof v === "number" && v > 25569 && v < 80000 && Number.isFinite(v)) {
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    let mo, d;
    if (a > 12 && b <= 12) { d = a; mo = b; }       // 第一位 > 12，歐/亞 D/M/YYYY
    else if (b > 12 && a <= 12) { d = b; mo = a; }  // 第二位 > 12，美式 M/D/YYYY
    else { mo = a; d = b; }                          // 同時 ≤ 12，採美式預設
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${m[3]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  // 最後手段：交給 JS Date 解析；但僅當年份落在合理區間（避免 "45671" 被誤認作西元 45671 年）
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) {
    const y = d2.getFullYear();
    if (y >= 1990 && y <= 2100) {
      return `${y}-${String(d2.getMonth() + 1).padStart(2, "0")}-${String(d2.getDate()).padStart(2, "0")}`;
    }
  }
  return null;
}

/* 生成樣本模板並觸發下載 */
function downloadTemplate() {
  const rows = [
    { "客戶編號": "C0001", "指定日期": "2024-12-31", "市場": "HK", "股票代碼": "700",   "股份數量": 100 },
    { "客戶編號": "C0001", "指定日期": "2024-12-31", "市場": "A",  "股票代碼": "600519","股份數量": 200 },
    { "客戶編號": "C0002", "指定日期": "2025-03-14", "市場": "US", "股票代碼": "AAPL",  "股份數量": 50  },
    { "客戶編號": "",        "指定日期": "",              "市場": "HK", "股票代碼": "9988",  "股份數量": 200 },
  ];
  /* 主工作表「持倉明細」：僅含實際上傳欄位（A–E），不含任何說明文字，
     避免上傳解析時把說明當成資料列（parseExcel 只讀第一個工作表）。 */
  const ws = XLSX.utils.json_to_sheet(rows, { header: EXCEL_HEADERS });
  ws["!cols"] = [
    { wch: 14 }, // A 客戶編號
    { wch: 14 }, // B 指定日期
    { wch: 8 },  // C 市場
    { wch: 12 }, // D 股票代碼
    { wch: 10 }, // E 股份數量
  ];

  /* 第二工作表「填寫說明」：欄位填寫說明集中於此，不污染主表 */
  const guideWs = XLSX.utils.aoa_to_sheet([
    ["📝 欄位填寫說明（此頁僅供參考，上傳時只需「持倉明細」工作表）"],
    ["欄位", "說明"],
    ["客戶編號", "選填。例：C0001、C0002。可留空；全檔皆空時結果改依「股票代碼」排序。"],
    ["指定日期", "選填。例：2024-12-31。系統查詢此日收市價；若整列留空則退回頂部「批量日期」。"],
    ["市場", "必填。HK=港股、A=A 股、US=美股（字母代碼，例如 AAPL）。"],
    ["股票代碼", "必填。港股輸入代碼數字即可，系統自動去前導零（例 700=0700、5=00005、1=00001）；A 股 6 位（例 600519）；美股字母（例 AAPL）。"],
    ["股份數量", "必填。正整數，例如 100、200。"],
  ]);
  guideWs["!cols"] = [{ wch: 14 }, { wch: 86 }];
  guideWs["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]; // 標題跨 A:B
  const guideHeadFill = { fill: { fgColor: { rgb: "FFF4C2" } }, font: { bold: true } };
  const guideWrap = { alignment: { wrapText: true, vertical: "top" } };
  // 標題列（第 2 列：欄位／說明）與欄位名列（A3:A7）黃底；說明列自動換行
  ["A2", "B2"].forEach((a) => { if (guideWs[a]) guideWs[a].s = guideHeadFill; });
  for (let r = 3; r <= 7; r++) {
    const aCell = XLSX.utils.encode_cell({ r: r - 1, c: 0 });
    if (guideWs[aCell]) guideWs[aCell].s = guideHeadFill;
    const bCell = XLSX.utils.encode_cell({ r: r - 1, c: 1 });
    if (guideWs[bCell]) guideWs[bCell].s = Object.assign({}, guideWs[bCell].s, guideWrap);
  }
  guideWs["!rows"] = [
    { hpt: 22 }, { hpt: 20 }, { hpt: 42 }, { hpt: 42 }, { hpt: 42 }, { hpt: 42 }, { hpt: 42 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "持倉明細");
  XLSX.utils.book_append_sheet(wb, guideWs, "填寫說明");
  XLSX.writeFile(wb, "持倉模板.xlsx");
}

/* 解析上傳的 xlsx -> rows[]（客戶編號可空、指定日期可空） */
async function parseExcel(file) {
  const buf = await file.arrayBuffer();
  let wb;
  try {
    wb = XLSX.read(buf, { type: "array" });
  } catch (e) {
    throw Object.assign(new Error(I18N.t("excel.readErr")), { status: 400 });
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  if (!raw.length) throw Object.assign(new Error(I18N.t("excel.empty")), { status: 400 });

  const header = raw[0].map((h) => String(h).trim());
  // 只要必填欄位存在即可；客戶編號、指定日期兩欄若缺失視為選填
  const required = ["市場", "股票代碼", "股份數量"];
  const missing = required.filter((h) => !header.includes(h));
  if (missing.length) {
      throw Object.assign(
        new Error(I18N.t("excel.missingCols", { missing: missing.join("、"), headers: EXCEL_HEADERS.join("、") })),
        { status: 400 }
      );
  }
  const idx = (name) => header.indexOf(name); // -1 表示缺欄位（可不填）
  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.every((v) => String(v).trim() === "")) continue;
    const shares = parseFloat(r[idx("股份數量")]);
    if (!shares || shares <= 0) {
      throw Object.assign(new Error(I18N.t("excel.rowShares", { i: i + 1 })), { status: 400 });
    }
    const marketVal = idx("市場") >= 0 ? String(r[idx("市場")]).trim().toUpperCase() : "";
    const codeVal = idx("股票代碼") >= 0 ? String(r[idx("股票代碼")]).trim() : "";
    if (!marketVal) throw Object.assign(new Error(I18N.t("excel.rowMarket", { i: i + 1 })), { status: 400 });
    if (!codeVal) throw Object.assign(new Error(I18N.t("excel.rowCode", { i: i + 1 })), { status: 400 });
    const clientVal = idx("客戶編號") >= 0 ? String(r[idx("客戶編號")]).trim() : "";
    const dateIdx = idx("指定日期");
    const dateCell = dateIdx >= 0 ? r[dateIdx] : null;
    rows.push({
      line: i + 1,
      client: clientVal,   // 允許空字串：標示這列不歸戶
      date: parseCellDate(dateCell),  // 可能為 null → 由呼叫端退回批量日期
      market: marketVal,
      code: codeVal,
      shares: shares,
    });
  }
  if (!rows.length) throw Object.assign(new Error(I18N.t("excel.noDataRows")), { status: 400 });
  return rows;
}

/* 依全檔判斷是否有「客戶編號」資料；無則依股票代碼排序，有則依客戶編號排序 */
function sortBatchRows(rows) {
  const hasClient = rows.some((r) => String(r.client || "").trim() !== "");
  const cmpStr = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  return rows.slice().sort((a, b) => {
    if (hasClient) {
      const c = cmpStr(a.client || "", b.client || "");
      if (c !== 0) return c;
    }
    const m = cmpStr(a.market || "", b.market || "");
    if (m !== 0) return m;
    return cmpStr(a.code || "", b.code || "");
  });
}

/* 匯出查詢結果 xlsx */
function exportResults(rows) {
  const data = rows.map((r) => ({
    "客戶編號": r.client || "",
    "指定日期": r.date || "",
    "市場": r.market || "",
    "股票代碼": r.code || "",
    "股票名稱(中)": r.name_cn || "",
    "股票名稱(英)": r.name_en || "",
    "股份數量": r.shares ?? "",
    "收市價": r.price ?? "",
    "原幣市值": r.market_value ?? "",
    "匯率(兌HKD)": r.fx_to_hkd ?? "",
    "港幣市值": r.hkd_value ?? "",
    "狀態": r.status || "",
    "備註": r.reason || r.note || "",
  }));
  const ws = XLSX.utils.json_to_sheet(data, {
    header: ["客戶編號", "指定日期", "市場", "股票代碼", "股票名稱(中)", "股票名稱(英)", "股份數量",
             "收市價", "原幣市值", "匯率(兌HKD)", "港幣市值", "狀態", "備註"],
  });
  ws["!cols"] = [{ wch: 10 }, { wch: 12 }, { wch: 7 }, { wch: 10 }, { wch: 16 }, { wch: 26 },
                 { wch: 9 }, { wch: 9 }, { wch: 12 }, { wch: 11 }, { wch: 12 }, { wch: 7 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "查詢結果");
  XLSX.writeFile(wb, `查詢結果_${Date.now().toString(36)}.xlsx`);
}
