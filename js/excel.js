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
  const ws = XLSX.utils.json_to_sheet(rows, { header: EXCEL_HEADERS });
  ws["!cols"] = [
    { wch: 14 }, // A 客戶編號
    { wch: 14 }, // B 指定日期
    { wch: 8 },  // C 市場
    { wch: 12 }, // D 股票代碼
    { wch: 10 }, // E 股份數量
    { wch: 3 },  // F 留空（上傳欄位僅到 E）
    { wch: 14 }, // G 說明欄位名
    { wch: 22 }, // H 說明文字
    { wch: 22 }, // I
    { wch: 22 }, // J
    { wch: 22 }, // K
  ];
  /* 在第 7 列（G 起）的「欄位說明」幫助使用者理解每個欄位要 input 什麼。
     說明移到 G 列之後，A–F 僅保留實際上傳欄位（A–E），使用者上傳時無須手刪說明區。 */
  const EXPLANATIONS = [
    { col: "G", head: "客戶編號", body: "選填。例：C0001、C0002。可留空；全檔皆空時結果改依「股票代碼」排序。" },
    { col: "G", head: "指定日期", body: "選填。例：2024-12-31。系統查詢此日收市價；若整列留空則退回頂部「批量日期」。" },
    { col: "G", head: "市場",     body: "必填。HK=港股、A=A 股、US=美股（字母代碼，例如 AAPL）。" },
    { col: "G", head: "股票代碼", body: "必填。港股輸入代碼數字即可，系統自動去前導零（例 700=0700、5=00005、1=00001）；A 股 6 位（例 600519）；美股字母（例 AAPL）。" },
    { col: "G", head: "股份數量", body: "必填。正整數，例如 100、200。" },
  ];
  // 在第 6 列加說明區的標題並把 G:K 合併為一格（A–F 不含說明）
  XLSX.utils.sheet_add_aoa(ws, [["📝 欄位填寫說明（上傳前可刪除 G 列起此區）"]], { origin: "G6" });
  const merges = [{ s: { r: 5, c: 6 }, e: { r: 5, c: 10 } }]; // G6 跨 G6:K6
  // 從第 7 列起：每欄一條「欄位名 + 說明」，欄位名置於 G 列（黃底），說明文字橫跨 H:K
  const guideStartRow = 7;
  const headFill = { fill: { fgColor: { rgb: "FFF4C2" } }, font: { bold: true } };
  EXPLANATIONS.forEach((exp, i) => {
    const r = guideStartRow + i;
    XLSX.utils.sheet_add_aoa(ws, [[exp.head, exp.body]], { origin: `G${r}` });
    merges.push({ s: { r: r - 1, c: 7 }, e: { r: r - 1, c: 10 } }); // 說明文字橫跨 H:K（4 欄）
    const headAddr = XLSX.utils.encode_cell({ r: r - 1, c: 6 });      // G 列欄位名（黃底）
    if (ws[headAddr]) ws[headAddr].s = headFill;
  });
  ws["!merges"] = merges;
  ws["!rows"] = [];
  for (let i = 0; i < guideStartRow - 1 + EXPLANATIONS.length; i++) ws["!rows"][i] = { hpt: 18 };
  ws["!rows"][5] = { hpt: 22 };                                     // 第 6 列：標題列稍高
  EXPLANATIONS.forEach((_, i) => { ws["!rows"][guideStartRow - 1 + i] = { hpt: 36 }; });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "持倉明細");
  XLSX.writeFile(wb, "持倉模板.xlsx");
}

/* 解析上傳的 xlsx -> rows[]（客戶編號可空、指定日期可空） */
async function parseExcel(file) {
  const buf = await file.arrayBuffer();
  let wb;
  try {
    wb = XLSX.read(buf, { type: "array" });
  } catch (e) {
    throw Object.assign(new Error("無法讀取檔案，請上傳有效的 .xlsx 檔案"), { status: 400 });
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  if (!raw.length) throw Object.assign(new Error("Excel 檔案為空"), { status: 400 });

  const header = raw[0].map((h) => String(h).trim());
  // 只要必填欄位存在即可；客戶編號、指定日期兩欄若缺失視為選填
  const required = ["市場", "股票代碼", "股份數量"];
  const missing = required.filter((h) => !header.includes(h));
  if (missing.length) {
    throw Object.assign(
      new Error(`表頭缺少必要欄位：${missing.join("、")}。正確欄位：${EXCEL_HEADERS.join("、")}（客戶編號、指定日期為可選填）`),
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
      throw Object.assign(new Error(`第 ${i + 1} 列「股份數量」無效或為 0`), { status: 400 });
    }
    const marketVal = idx("市場") >= 0 ? String(r[idx("市場")]).trim().toUpperCase() : "";
    const codeVal = idx("股票代碼") >= 0 ? String(r[idx("股票代碼")]).trim() : "";
    if (!marketVal) throw Object.assign(new Error(`第 ${i + 1} 列「市場」為空`), { status: 400 });
    if (!codeVal) throw Object.assign(new Error(`第 ${i + 1} 列「股票代碼」為空`), { status: 400 });
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
  if (!rows.length) throw Object.assign(new Error("Excel 中沒有數據行"), { status: 400 });
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
