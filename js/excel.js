/* =====================================================================
 * Excel 處理（SheetJS）：模板生成、上傳解析、結果匯出 —— 純瀏覽器端
 * ===================================================================== */
"use strict";

const EXCEL_HEADERS = ["客戶編號", "市場", "股票代碼", "股份數量"];

/* 生成樣本模板並觸發下載 */
function downloadTemplate() {
  const rows = [
    { "客戶編號": "C0001", "市場": "HK", "股票代碼": "0700", "股份數量": 100 },
    { "客戶編號": "C0001", "市場": "A", "股票代碼": "600519", "股份數量": 200 },
    { "客戶編號": "C0002", "市場": "US", "股票代碼": "AAPL", "股份數量": 50 },
  ];
  const ws = XLSX.utils.json_to_sheet(rows, { header: EXCEL_HEADERS });
  ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "持倉明細");
  XLSX.writeFile(wb, "持倉模板.xlsx");
}

/* 解析上傳的 xlsx -> rows[] */
async function parseExcel(file) {
  const buf = await file.arrayBuffer();
  let wb;
  try {
    wb = XLSX.read(buf, { type: "array" });
  } catch (e) {
    throw Object.assign(new Error("無法讀取檔案，請上傳有效的 .xlsx 檔案"), { status: 400 });
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (!raw.length) throw Object.assign(new Error("Excel 檔案為空"), { status: 400 });

  const header = raw[0].map((h) => String(h).trim());
  const missing = EXCEL_HEADERS.filter((h) => !header.includes(h));
  if (missing.length) {
    throw Object.assign(
      new Error(`表頭缺少欄位：${missing.join("、")}。正確欄位：${EXCEL_HEADERS.join("、")}`),
      { status: 400 }
    );
  }
  const idx = (name) => header.indexOf(name);
  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.every((v) => String(v).trim() === "")) continue;
    const shares = parseFloat(r[idx("股份數量")]);
    rows.push({
      line: i + 1,
      client: String(r[idx("客戶編號")]).trim(),
      market: String(r[idx("市場")]).trim().toUpperCase(),
      code: String(r[idx("股票代碼")]).trim(),
      shares: isNaN(shares) ? 0 : shares,
    });
  }
  if (!rows.length) throw Object.assign(new Error("Excel 中沒有數據行"), { status: 400 });
  return rows;
}

/* 匯出查詢結果 xlsx */
function exportResults(rows) {
  const data = rows.map((r) => ({
    "客戶編號": r.client || "",
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
    header: ["客戶編號", "市場", "股票代碼", "股票名稱(中)", "股票名稱(英)", "股份數量",
             "收市價", "原幣市值", "匯率(兌HKD)", "港幣市值", "狀態", "備註"],
  });
  ws["!cols"] = [{ wch: 10 }, { wch: 7 }, { wch: 10 }, { wch: 16 }, { wch: 26 },
                 { wch: 9 }, { wch: 9 }, { wch: 12 }, { wch: 11 }, { wch: 12 }, { wch: 7 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "查詢結果");
  XLSX.writeFile(wb, `查詢結果_${Date.now().toString(36)}.xlsx`);
}
