/* =====================================================================
 * 持倉總覽（portfolio.js）
 *  - 持倉 CRUD + localStorage 本機保存
 *  - 計算跨市場港幣市值、未實現盈虧（接 getClosePrice + fetchFx）
 *  - 組合淨值走勢（近 180 交易日）
 *  - Excel 匯出 / 列印 PDF
 *  - 歷史 K 線（接 fetchTencentBars / fetchUsBars）
 *  多語系：所有可見字串改經 I18N.t；MARKET_LABEL 為 i18n.js 提供的語言感知函式。
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
    ["HK", "700", 1000, ""],
    ["HK", "9988", 2000, ""],
    ["A",  "600519", 100, ""],
    ["A",  "300750", 300, ""],
    ["US", "AAPL", 200, ""],
    ["US", "TSLA", 50, ""],
    ["HK", "5", 4000, ""],
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
    `<option value="${m}" ${m === sel ? "selected" : ""}>${MARKET_LABEL(m) || m}</option>`
  ).join("");
}

function renderTable() {
  const body = $pf("pf-body");
  if (!pfHoldings.length) {
    body.innerHTML = `<tr><td colspan="8" class="pf-muted" style="text-align:center;padding:22px">${I18N.t("pf.empty")}</td></tr>`;
    return;
  }
  body.innerHTML = pfHoldings.map((h, i) => {
    const r = pfResults[i];
    const priceCell = r && r.ok
      ? `${fmtMoneyHtml(r.price)} <span class="pf-muted">${r.currency}</span>`
      : (r ? `<span class="up">${I18N.t("pf.noData")}</span>` : `—`);
    const mvCell = r && r.ok ? `HK$${fmtMoneyHtml(r.hkd)}` : (r ? `<span class="up">—</span>` : `—`);
    let plCell = `—`;
    if (r && r.ok && r.pl !== null) {
      const sign = r.pl >= 0 ? "+" : "";
      const cls = r.pl >= 0 ? "up" : "down";
      const pct = r.plPct !== null ? ` (${sign}${r.plPct.toFixed(2)}%)` : "";
      plCell = `<span class="${cls}">${sign}HK$${fmtMoneyHtml(r.pl)}${pct}</span>`;
    } else if (r && r.ok) {
      plCell = `<span class="pf-muted">${I18N.t("pf.noCost")}</span>`;
    } else if (r) {
      plCell = `<span class="up" title="${escAttr(r.error || "")}">${I18N.t("pf.fail")}</span>`;
    }
    return `
      <tr data-i="${i}">
        <td data-label="${escAttr(I18N.t("pf.th.market"))}"><select class="field-inline" data-f="market">${marketOptions(h.market)}</select></td>
        <td data-label="${escAttr(I18N.t("pf.th.code"))}"><input class="field-inline" data-f="code" value="${escAttr(h.code)}" autocomplete="off"></td>
        <td data-label="${escAttr(I18N.t("pf.th.shares"))}"><input class="field-inline num" data-f="shares" type="number" min="0" step="any" value="${escAttr(h.shares)}"></td>
        <td data-label="${escAttr(I18N.t("pf.th.cost"))}"><input class="field-inline num" data-f="cost" type="number" min="0" step="any" placeholder="${escAttr(I18N.t("pf.costPh"))}" value="${escAttr(h.cost)}"></td>
        <td data-label="${escAttr(I18N.t("pf.th.price"))}" class="pf-val">${priceCell}</td>
        <td data-label="${escAttr(I18N.t("pf.th.mv"))}" class="pf-val">${mvCell}</td>
        <td data-label="${escAttr(I18N.t("pf.th.pl"))}" class="pf-val">${plCell}</td>
        <td class="col-act"><button class="pf-del" data-del="${i}" title="${escAttr(I18N.t("pf.delTitle"))}" type="button">×</button></td>
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
  btn.disabled = true; btn.textContent = I18N.t("pf.computing");
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
        if (!h.code || !h.market) throw new Error(I18N.t("pf.err.blank"));
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
    $pf("k-pf-total").innerHTML = "HK$" + fmtMoneyHtml(totalHkd);
    $pf("k-pf-cost").innerHTML = "HK$" + fmtMoneyHtml(totalCost);
    const plEl = $pf("k-pf-pl");
    plEl.innerHTML = (totalPl >= 0 ? "+" : "") + "HK$" + fmtMoneyHtml(totalPl);
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
    btn.disabled = false; btn.textContent = I18N.t("pf.btn");
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
    tr.querySelectorAll("[data-f]").forEach((inp) => {
      let v = inp.value;
      if (inp.dataset.f === "code" && String(pfHoldings[i].market).toUpperCase() === "HK") v = hkCanon(v);
      pfHoldings[i][inp.dataset.f] = v;
    });
  });
}

function showPfMsg(msg) {
  const el = $pf("pf-msg");
  el.hidden = false;
  el.innerHTML = `<span aria-hidden="true">⚠</span><div>${esc(msg)}</div>`;
}

/* ---------- 匯出 Excel ---------- */
function exportPortfolioExcel() {
  if (typeof XLSX === "undefined") { showPfMsg(I18N.t("pf.noExcel")); return; }
  const headers = I18N.t("pf.export.headers"); // 陣列，順序即欄位順序
  const data = pfHoldings.map((h, i) => {
    const r = pfResults[i];
    const row = {};
    row[headers[0]] = MARKET_LABEL(h.market) || h.market;
    row[headers[1]] = h.code || "";
    row[headers[2]] = h.shares ?? "";
    row[headers[3]] = h.cost ?? "";
    row[headers[4]] = r && r.ok ? r.price : "";
    row[headers[5]] = r && r.ok ? r.currency : "";
    row[headers[6]] = r && r.ok ? pfRound2(r.hkd) : "";
    row[headers[7]] = r && r.ok ? pfRound2(r.costHkd || 0) : "";
    row[headers[8]] = r && r.ok ? (r.pl === null ? "" : pfRound2(r.pl)) : "";
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  ws["!cols"] = [{ wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, I18N.t("pf.export.sheet"));
  XLSX.writeFile(wb, `${I18N.t("pf.export.file")}_${Date.now().toString(36)}.xlsx`);
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
  if (!code) { $pf("h-msg").hidden = false; $pf("h-msg").innerHTML = `<span aria-hidden="true">⚠</span><div>${esc(I18N.t("pf.kline.errCode"))}</div>`; return; }
  const btn = $pf("h-submit");
  btn.disabled = true; btn.textContent = I18N.t("pf.kline.loading");
  try {
    const symbol = normalizeSymbol(code, market);
    if (!symbol) throw new Error(I18N.t("pf.kline.badCode"));
    const bars = market === "US" ? await fetchUsBars(symbol) : await fetchTencentBars(symbol);
    if (!bars || !bars.length) throw new Error(I18N.t("pf.kline.noData"));
    const names = await fetchNames(symbol);
    const dispCode = displaySymbol(market, code);
    const titleArgs = { name: names.cn || code, market: MARKET_LABEL(market), code: dispCode };
    window.__pfKlineTitle = titleArgs;
    $pf("h-curve-title").textContent = I18N.t("pf.kline.title", titleArgs);
    $pf("h-curve-box").hidden = false;
    renderKline("chartKline", bars);
  } catch (err) {
    $pf("h-msg").hidden = false;
    $pf("h-msg").innerHTML = `<span aria-hidden="true">⚠</span><div>${esc(err.message)}</div>`;
    $pf("h-curve-box").hidden = true;
  } finally {
    btn.disabled = false; btn.textContent = I18N.t("history.btn");
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

  /* 語言切換時重渲染持倉表與 K 線標題 */
  I18N.registerDynamic(function () {
    renderTable();
    if (window.__pfKlineTitle && !$pf("h-curve-box").hidden) {
      $pf("h-curve-title").textContent = I18N.t("pf.kline.title", window.__pfKlineTitle);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPortfolio);
} else {
  initPortfolio();
}
