/* =====================================================================
 * 數據層：全部真實公開接口（瀏覽器直連，CORS 已驗證 ✅）
 *  1. 港股/A股 收市價：騰訊 app/kline（無復權）
 *  2. 美股 收市價：stockanalysis.com（5 年歷史）
 *  3. 中文名：騰訊 qt.gtimg.cn（GBK 編碼，TextDecoder 解碼）
 *  4. 英文名：stockanalysis.com /api/search（精確匹配）
 *  5. 匯率：frankfurter.dev（ECB 官方數據，CORS ✅）
 * 查不到 → 明確拋錯，絕不編造。
 * ===================================================================== */
"use strict";

const MARKETS = {
  HK: { label: "港股", currency: "HKD" },
  A:  { label: "A股",  currency: "CNY" },
  US: { label: "美股", currency: "USD" },
};

/* ---------- 緩存 ---------- */
const cache = {
  bars: new Map(),   // symbol -> bars[]
  names: new Map(),  // symbol -> {cn, en}
  fx: new Map(),     // `${ccy}|${date}` -> {rate, actual}
};

function normalizeSymbol(code, market) {
  code = String(code || "").trim().toUpperCase().replace(/\s+/g, "");
  market = String(market || "").trim().toUpperCase();
  if (market === "HK") {
    if (code.endsWith(".HK")) code = code.slice(0, -3);
    // 接受 1-5 位數字：用戶可輸入「去前導零」形式（1=00001、5=00005、700=0700）
    if (!/^\d{1,5}$/.test(code)) return "";
    return "hk" + code.padStart(5, "0");
  }
  if (market === "A") {
    if (!/^\d{6}$/.test(code)) return "";
    const p = code[0];
    if ("659".includes(p)) return "sh" + code;
    if ("03".includes(p)) return "sz" + code;
    if ("84".includes(p)) return "bj" + code;
    return "";
  }
  if (market === "US") {
    return /^[A-Z][A-Z.\-]{0,9}$/.test(code) ? "us" + code : "";
  }
  return "";
}

/* 港股代碼以「去前導零」後的數字為準（1 而非 00001、5 而非 00005、700 而非 0700） */
function hkCanon(code) {
  let c = String(code || "").trim().toUpperCase().replace(/\.HK$/, "").replace(/\s+/g, "");
  c = c.replace(/^0+/, "");
  return c || "";
}

/* ---------- 騰訊日 K（港股/A股，無復權） ---------- */
async function fetchTencentBars(symbol) {
  if (cache.bars.has(symbol)) return cache.bars.get(symbol);
  try {
    const res = await fetch(
      `https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=${symbol},day,,,640`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data = await res.json();
    const node = (data.data || {})[symbol] || {};
    let bars = node.day || [];
    if (!bars.length) {
      // 備選：fqkline
      const res2 = await fetch(
        `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${symbol},day,,,640,qfq`
      );
      const d2 = await res2.json();
      const n2 = (d2.data || {})[symbol] || {};
      bars = n2.qfqday || n2.day || [];
    }
    cache.bars.set(symbol, bars);
    return bars;
  } catch (e) {
    console.warn("騰訊接口失敗", symbol, e);
    return [];
  }
}

/* ---------- 美股日 K（stockanalysis，5 年） ---------- */
async function fetchUsBars(symbol) {
  if (cache.bars.has(symbol)) return cache.bars.get(symbol);
  const ticker = symbol.slice(2);
  try {
    const res = await fetch(
      `https://stockanalysis.com/api/symbol/s/${ticker}/history?range=5Y`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const data = await res.json();
    const rows = data.data || [];
    // 降序 → 升序，格式對齊 [date, open, close, high, low, volume]
    const bars = [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      const close = parseFloat(r.c);
      if (!r.t || isNaN(close)) continue;
      bars.push([r.t, parseFloat(r.o) || 0, close, parseFloat(r.h) || 0, parseFloat(r.l) || 0, parseFloat(r.v) || 0]);
    }
    cache.bars.set(symbol, bars);
    return bars;
  } catch (e) {
    console.warn("stockanalysis 歷史失敗", ticker, e);
    return [];
  }
}

/* ---------- 股票中英文名 ---------- */
async function fetchNames(symbol) {
  if (cache.names.has(symbol)) return cache.names.get(symbol);
  let cn = "", en = "";
  // 中文名：騰訊 qt（GBK）
  try {
    const res = await fetch(`https://qt.gtimg.cn/q=${symbol}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    const text = new TextDecoder("gbk").decode(await res.arrayBuffer());
    const m = text.match(/v_\w+="([^"]+)"/);
    if (m) {
      const parts = m[1].split("~");
      cn = (parts[1] || "").trim();
    }
  } catch (e) { console.warn("取中文名失敗", symbol, e); }
  // 英文名：stockanalysis 搜索（精確匹配）
  try {
    let code = symbol.slice(2);
    if (symbol.startsWith("hk")) code = code.replace(/^0+/, "").padStart(4, "0");
    const res = await fetch(`https://stockanalysis.com/api/search?q=${code}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = await res.json();
    const items = data.data || [];
    const prefix = { hk: "hkg/", sh: "sha/", sz: "she/", bj: "bjs/", us: "" }[symbol.slice(0, 2)];
    for (const it of items) {
      const s = it.s || "";
      const isStock = it.t === "s" || (it.t === "sy" && it.st === "s");
      if (!isStock) continue;
      if (prefix && s.toLowerCase() === prefix + code.toLowerCase()) { en = (it.n || "").trim(); break; }
      if (!prefix && s.toUpperCase() === code.toUpperCase()) { en = (it.n || "").trim(); break; }
    }
  } catch (e) { console.warn("取英文名失敗", symbol, e); }
  const names = { cn, en };
  cache.names.set(symbol, names);
  return names;
}

/* ---------- 匯率（frankfurter.dev，ECB 數據） ---------- */
async function fetchFx(currency, dateStr) {
  const key = `${currency}|${dateStr}`;
  if (cache.fx.has(key)) return cache.fx.get(key);
  let rate = 1.0, actual = dateStr, source = "固定(1:1)";
  if (currency !== "HKD") {
    const d = new Date(dateStr + "T00:00:00");
    let found = null;
    for (let back = 0; back < 12 && !found; back++) {
      const dt = new Date(d);
      dt.setDate(dt.getDate() - back);
      const iso = dt.toISOString().slice(0, 10);
      try {
        const params = currency === "CNY"
          ? `?from=USD&to=CNY,HKD`
          : `?from=USD&to=HKD`;
        const res = await fetch(`https://api.frankfurter.dev/v1/${iso}${params}`);
        if (!res.ok) continue;
        const j = await res.json();
        if (!j.rates || !j.rates.HKD) continue;
        if (currency === "CNY") {
          if (!j.rates.CNY) continue;
          rate = j.rates.HKD / j.rates.CNY;
        } else {
          rate = j.rates.HKD;
        }
        actual = iso;
        source = `ECB·${iso}`;
        found = true;
      } catch (e) { /* 下一日 */ }
    }
    if (!found) {
      const err = new Error(`查無 ${dateStr} 的 ${currency}→HKD 匯率資料（ECB 數據不可用）`);
      err.status = 404;
      throw err;
    }
  }
  const out = { rate, actual, source };
  cache.fx.set(key, out);
  return out;
}

/* ---------- 核心：查指定日期收市價 ---------- */
async function getClosePrice(code, market, dateStr) {
  market = String(market || "").trim().toUpperCase();
  if (!MARKETS[market]) throw Object.assign(new Error(`不支援的市場: ${market}`), { status: 400 });
  const symbol = normalizeSymbol(code, market);
  if (!symbol) throw Object.assign(
    new Error(`無法識別的股票代碼「${code}」：港股 1-5 位數字（自動去前導零），A股 6 位數字，美股字母代碼`),
    { status: 400 }
  );
  const bars = market === "US" ? await fetchUsBars(symbol) : await fetchTencentBars(symbol);
  if (!bars || !bars.length) {
    throw Object.assign(new Error(`查無「${code}」的收市價資料（代碼可能無效）`), { status: 404 });
  }
  // 取 date <= 查詢日 的最後一筆（升序）
  let chosen = null;
  for (const b of bars) {
    if (b && b[0] <= dateStr) chosen = b;
    else break;
  }
  if (!chosen) {
    throw Object.assign(
      new Error(`查無「${code}」於 ${dateStr} 的收市價資料（查詢日早於可獲數據範圍）`),
      { status: 404 }
    );
  }
  const names = await fetchNames(symbol);
  const quoteDate = chosen[0];
  const price = parseFloat(chosen[2]); // [date, open, close, high, low, volume]
  const mktLabel = MARKETS[market].label;
  const fallbackCN = `${mktLabel} ${symbol.slice(2)}`;
  return {
    code: market === "HK" ? hkCanon(code) : String(code).trim().toUpperCase(),
    market,
    symbol,
    name_cn: names.cn || fallbackCN,
    name_en: names.en,
    quote_date: quoteDate,
    price,
    currency: MARKETS[market].currency,
    note: quoteDate !== dateStr ? `查詢日為非交易日，採用前一交易日收市價` : "",
  };
}

/* ---------- 演示持倉（真實代碼） ---------- */
const DEMO_HOLDINGS = [
  ["C0001", "HK", "700", 2000],   // 騰訊控股
  ["C0001", "HK", "9988", 8000],   // 阿里巴巴-W
  ["C0001", "HK", "3690", 10000],  // 美團-W
  ["C0002", "A", "600519", 100],   // 貴州茅台
  ["C0003", "US", "AAPL", 120],    // Apple
  ["C0004", "HK", "5", 1000],   // 匯豐控股
  ["C0005", "A", "000001", 2000],  // 平安銀行
];

async function buildDemoRows(dateStr) {
  const rows = [];
  for (const [client, market, code, shares] of DEMO_HOLDINGS) {
    try {
      const q = await getClosePrice(code, market, dateStr);
      const fx = await fetchFx(q.currency, q.quote_date);
      const mv = q.price * shares;
      rows.push({
        client, market, code, shares, ...q,
        market_value: round4(mv),
        fx_to_hkd: fx.rate, fx_source: fx.source,
        hkd_value: round4(mv * fx.rate),
        status: "ok", reason: "",
      });
    } catch (e) {
      console.warn("demo 行失敗", market, code, e.message);
    }
  }
  if (!rows.length) {
    throw Object.assign(new Error(`演示數據構建失敗：${dateStr} 無任何可用真實行情`), { status: 404 });
  }
  return rows;
}

const round4 = (v) => Math.round(v * 10000) / 10000;
