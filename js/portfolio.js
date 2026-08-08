/* =====================================================================
 * 持倉總覽（portfolio.js）
 *  - 持倉 CRUD + localStorage 本機保存
 *  - 計算跨市場港幣市值、未實現盈虧（接 getClosePrice + fetchFx）
 *  - 組合淨值走勢（近 180 交易日）
 *  - Excel 匯出 / 列印 PDF
 *  - 歷史 K 線（接 fetchTencentBars / fetchUsBars）
 * ===================================================================== */
"use strict";

const PF_KEY = "pf_holdings_v2";
const pfRound2 = (v) => Math.round(v * 100) / 100;
const $pf = (id) => document.getElementById(id);

let pfHoldings = loadHoldings();
let pfResults = [];

function defaultHoldings() {
  // 與 data.js 的 DEMO_HOLDINGS 對齊（真實代碼，成本留空）
  return [
    ["HK", "0700", 1000, ""],
    ["HK", "9988", 2000, ""],
    ["A",  "600519", 100, ""],
    ["A",  "300750", 300, ""],
    ["US", "AAPL", 200, ""],
    ["US", "TSLA", 50, ""],
    ["HK", "0005", 4000, ""],
    ["A",  "000001", 5000, ""],
  ].map(([market, code, shares, cost]) => ({ market, code, shares, cost }));
}

function loadHoldings() {
  try {
    const s = localStorage.getItem(PF_KEY);
    if (s) {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch (e) { /* ignore */ }
  return defaultHoldings();
}
function saveHoldings() {
  try { localStorage.setItem(PF_KEY, JSON.stringify(pfHoldings)); } catch (e) { /* ignore */ }
}

function marketOptions(sel) {
  return ["HK", "A", "US"].map((m) =>
    `<option value="${m}" ${m === sel ? "selected" : ""}>${MARKET_LABEL[m] || m}</option>`
  ).join("");
}

function renderTable() {
  const body = $pf("pf-body");
  if (!pfHoldings.length) {
    body.innerHTML = `<tr><td colspan="8" class="pf-muted" style="text-align:center;padding:22px">尚無持倉，點擊「＋ 新增持倉」開始。</td></tr>`;
    return;
  }
  body.innerHTML = pfHoldings.map((h, i) => {
    const r = pfResults[i];
    const priceCell = r && r.ok
      ? `${fmtMoney(r.price)} <span class="pf-muted">${r.currency}</span>`
      : (r ? `<span class="up">查無</span>` : `—`);
    const mvCell = r && r.ok ? `HK$${fmtMoney(r.hkd)}` : (r ? `<span class="up">—</span>` : `—`);
    let plCell = `—`;
    if (r && r.ok && r.pl !== null) {
      const sign = r.pl >= 0 ? "+" : "";
      const cls = r.pl >= 0 ? "up" : "down";
      const pct = r.plPct !== null ? ` (${sign}${r.plPct.toFixed(2)}%)` : "";
      plCell = `<span class="${cls}">${sign}HK$${fmtMoney(r.pl)}${pct}</span>`;
    } else if (r && r.ok) {
      plCell = `<span class="pf-muted">未設成本</span>`;
    } else if (r) {
      plCell = `<span class="up" title="${escAttr(r.error || "")}">失敗</span>`;
    }
    return `
      <tr data-i="${i}">
        <td data-label="市場"><select class="field-inline" data-f="market">${marketOptions(h.market)}</select></td>
        <td data-label="股票代碼"><input class="field-inline" data-f="code" value="${escAttr(h.code)}" autocomplete="off"></td>
        <td data-label="股數"><input class="field-inline num" data-f="shares" type="number" min="0" step="any" value="${escAttr(h.shares)}"></td>
        <td data-label="成本價"><input class="field-inline num" data-f="cost" type="number" min="0" step="any" placeholder="選填" value="${escAttr(h.cost)}"></td>
        <td data-label="現價" class="pf-val">${priceCell}</td>
        <td data-label="港幣市值" class="pf-val">${mvCell}</td>
        <td data-label="未實現盈虧" class="pf-val">${plCell}</td>
        <td class="col-act"><button class="pf-del" data-del="${i}" title="刪除" type="button">×</button></td>
      </tr>`;
  }).join("");
}

/* ---------- 事件委託 ---------- */
function bindTableEvents() {
  const body = $pf("pf-body");
  body.addEventListener("input", (e) => {
    const inp = e.target.closest("[data-f]");
    if (!inp) return;
    const tr = inp.closest("tr"); const i = +tr.dataset.i; const f = inp.dataset.f;
    pfHoldings[i][f] = inp.value;
    saveHoldings();
  });
  body.addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (!del) return;
    const i = +del.dataset.del;
    pfHoldings.splice(i, 1);
    pfResults = [];
    saveHoldings();
    renderTable();
    $pf("pf-kpis").hidden = true;
    $pf("pf-curve-box").hidden = true;
  });
}

/* ---------- 計算市值 ---------- */
async function computePortfolio() {
  // 先從 DOM 同步（避免漏存）
  syncFromDom();
  saveHoldings();
  const btn = $pf("pf-compute");
  btn.disabled = true; btn.textContent = "計算中…";
  $pf("pf-loading").hidden = false;
  $pf("pf-msg").hidden = true;
  $pf("pf-kpis").hidden = true;
  $pf("pf-curve-box").hidden = true;

  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  pfResults = new Array(pfHoldings.length).fill(null);
  const curveTasks = [];

  try {
    for (let i = 0; i < pfHoldings.length; i++) {
      const h = pfHoldings[i];
      try {
        if (!h.code || !h.market) throw new Error("代碼或市場空白");
        const q = await getClosePrice(h.code, h.market, today);
        const fx = await fetchFx(q.currency, q.quote_date);
        const shares = parseFloat(h.shares) || 0;
        const hkd = pfRound2(q.price * shares * fx.rate);
        const costPrice = parseFloat(h.cost) || 0;
        const hasCost = costPrice > 0 && shares > 0;
        const costHkd = hasCost ? pfRound2(costPrice * shares * fx.rate) : 0;
        const pl = hasCost ? pfRound2(hkd - costHkd) : null;
        const plPct = hasCost && costHkd > 0 ? (pl / costHkd) * 100 : null;
        pfResults[i] = { ok: true, price: q.price, currency: q.currency, hkd, costHkd, pl, plPct, fxRate: fx.rate, note: q.note };
        if (hasCost && shares > 0) curveTasks.push({ symbol: q.symbol, market: h.market, shares, fxRate: fx.rate });
      } catch (err) {
        pfResults[i] = { ok: false, error: err.message };
      }
    }

    // KPI
    const ok = pfResults.filter((r) => r && r.ok);
    const totalHkd = pfRound2(ok.reduce((s, r) => s + r.hkd, 0));
    const totalCost = pfRound2(ok.reduce((s, r) => s + (r.costHkd || 0), 0));
    const totalPl = pfRound2(ok.reduce((s, r) => s + (r.pl || 0), 0));
    $pf("k-pf-total").textContent = "HK$" + fmtMoney(totalHkd);
    $pf("k-pf-cost").textContent = "HK$" + fmtMoney(totalCost);
    const plEl = $pf("k-pf-pl");
    plEl.textContent = (totalPl >= 0 ? "+" : "") + "HK$" + fmtMoney(totalPl);
    plEl.className = "kpi-value " + (totalPl >= 0 ? "up" : "down");
    $pf("k-pf-count").textContent = ok.length;
    $pf("pf-kpis").hidden = false;

    renderTable();

    // 組合淨值走勢
    if (curveTasks.length) {
      try {
        const series = await buildPortfolioSeries(curveTasks);
        if (series && series.length) {
          $pf("pf-curve-box").hidden = false;
          renderPortfolioCurve("pf-curve", series);
        }
      } catch (e) { console.warn("組合曲線失敗", e); }
    }
  } catch (err) {
    showPfMsg(err.message);
  } finally {
    btn.disabled = false; btn.textContent = "計算市值";
    $pf("pf-loading").hidden = true;
  }
}

/* 組合淨值序列：各標的收盤價 × 股數 × 匯率，按日期加總（近 180 交易日） */
async function buildPortfolioSeries(tasks) {
  const perHolding = await Promise.all(tasks.map(async (t) => {
    try {
      const bars = t.market === "US" ? await fetchUsBars(t.symbol) : await fetchTencentBars(t.symbol);
      if (!bars || !bars.length) return null;
      const recent = bars.slice(-180);
      const m = {};
      for (const b of recent) m[b[0]] = (parseFloat(b[2]) || 0) * t.shares * t.fxRate;
      return m;
    } catch (e) { return null; }
  }));
  const valid = perHolding.filter(Boolean);
  if (!valid.length) return [];
  const allDates = [...new Set(valid.flatMap((m) => Object.keys(m)))].sort();
  return allDates.map((d) => {
    let sum = 0;
    for (const m of valid) if (d in m) sum += m[d];
    return [d, pfRound2(sum)];
  });
}

function syncFromDom() {
  document.querySelectorAll("#pf-body tr[data-i]").forEach((tr) => {
    const i = +tr.dataset.i;
    tr.querySelectorAll("[data-f]").forEach((inp) => { pfHoldings[i][inp.dataset.f] = inp.value; });
  });
}

function showPfMsg(msg) {
  const el = $pf("pf-msg");
  el.hidden = false;
  el.innerHTML = `<span aria-hidden="true">⚠</span><div>${esc(msg)}</div>`;
}

/* ---------- 匯出 Excel ---------- */
function exportPortfolioExcel() {
  if (typeof XLSX === "undefined") { showPfMsg("Excel 元件未載入"); return; }
  const data = pfHoldings.map((h, i) => {
    const r = pfResults[i];
    return {
      "市場": MARKET_LABEL[h.market] || h.market,
      "股票代碼": h.code || "",
      "股份數量": h.shares ?? "",
      "成本價": h.cost ?? "",
      "現價": r && r.ok ? r.price : "",
      "原幣": r && r.ok ? r.currency : "",
      "港幣市值": r && r.ok ? pfRound2(r.hkd) : "",
      "港幣成本": r && r.ok ? pfRound2(r.costHkd || 0) : "",
      "未實現盈虧": r && r.ok ? (r.pl === null ? "" : pfRound2(r.pl)) : "",
    };
  });
  const ws = XLSX.utils.json_to_sheet(data, {
    header: ["市場", "股票代碼", "股份數量", "成本價", "現價", "原幣", "港幣市值", "港幣成本", "未實現盈虧"],
  });
  ws["!cols"] = [{ wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "持倉總覽");
  XLSX.writeFile(wb, `持倉總覽_${Date.now().toString(36)}.xlsx`);
}

/* ---------- 列印 / PDF ---------- */
function printReport() { window.print(); }

/* ---------- 新增持倉 ---------- */
function addHolding() {
  pfHoldings.push({ market: "HK", code: "", shares: "", cost: "" });
  pfResults = [];
  saveHoldings();
  renderTable();
  // 滾動到表尾並聚焦新行的代碼輸入
  const rows = document.querySelectorAll("#pf-body tr[data-i]");
  const last = rows[rows.length - 1];
  if (last) { last.scrollIntoView({ behavior: "smooth", block: "center" }); const inp = last.querySelector('[data-f="code"]'); if (inp) inp.focus(); }
}

/* ---------- 歷史 K 線 ---------- */
async function submitKline(e) {
  e.preventDefault();
  const market = $pf("h-market").value;
  const code = $pf("h-code").value.trim();
  $pf("h-msg").hidden = true;
  if (!code) { $pf("h-msg").hidden = false; $pf("h-msg").innerHTML = `<span aria-hidden="true">⚠</span><div>請輸入股票代碼</div>`; return; }
  const btn = $pf("h-submit");
  btn.disabled = true; btn.textContent = "載入中…";
  try {
    const symbol = normalizeSymbol(code, market);
    if (!symbol) throw new Error("無法識別的代碼");
    const bars = market === "US" ? await fetchUsBars(symbol) : await fetchTencentBars(symbol);
    if (!bars || !bars.length) throw new Error("查無歷史資料");
    const names = await fetchNames(symbol);
    $pf("h-curve-title").textContent = `日 K 線 — ${names.cn || code}（${MARKET_LABEL[market]} ${code}）`;
    $pf("h-curve-box").hidden = false;
    renderKline("chartKline", bars);
  } catch (err) {
    $pf("h-msg").hidden = false;
    $pf("h-msg").innerHTML = `<span aria-hidden="true">⚠</span><div>${esc(err.message)}</div>`;
    $pf("h-curve-box").hidden = true;
  } finally {
    btn.disabled = false; btn.textContent = "查看 K 線";
  }
}

/* ---------- 初始化 ---------- */
function initPortfolio() {
  renderTable();
  bindTableEvents();
  $pf("pf-add").addEventListener("click", addHolding);
  $pf("pf-compute").addEventListener("click", computePortfolio);
  $pf("pf-export").addEventListener("click", exportPortfolioExcel);
  $pf("pf-print").addEventListener("click", printReport);
  $pf("kline-form").addEventListener("submit", submitKline);
  // 預設自動計算一次（演示持倉）
  computePortfolio();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPortfolio);
} else {
  initPortfolio();
}
