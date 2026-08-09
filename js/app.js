/* ================= Nora-AI Capital · 主邏輯（純前端） ================= */
"use strict";

const $ = (id) => document.getElementById(id);
const state = { rows: [], rowsFromDemo: true, lastRows: null };

/* ---------- 工具 ---------- */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const esc = (s) => String(s ?? "").replace(/</g, "&lt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");

function showError(el, msg) {
  el.hidden = false;
  el.innerHTML = `<span aria-hidden="true">⚠</span><div>${esc(msg)}</div>`;
}

/* ---------- 滾動漸入動效 ---------- */
function initReveal() {
  // 自動為主要區塊添加漸入
  document.querySelectorAll(".section, .card, .hero-meta").forEach((el) => el.classList.add("reveal"));
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
  els.forEach((el) => io.observe(el));
}

/* ---------- 單筆查詢 ---------- */
async function submitQuote(e) {
  e.preventDefault();
  const btn = $("q-submit");
  btn.disabled = true; btn.textContent = "查詢中…";
  $("q-result").hidden = true;
  try {
    const code = $("q-code").value.trim();
    const market = $("q-market").value;
    const date = $("q-date").value;
    if (!code || !date) throw new Error("請填寫股票代碼與查詢日期");
    const q = await getClosePrice(code, market, date);
    const shares = parseFloat($("q-shares").value);
    const fx = await fetchFx(q.currency, q.quote_date);
    const mv = shares > 0 ? round2(q.price * shares) : null;
    const hkd = mv !== null ? round2(mv * fx.rate) : null;
    renderQuote({ ...q, shares: shares > 0 ? shares : null, market_value: mv, fx_to_hkd: fx.rate, hkd_value: hkd, fx_source: fx.source });
  } catch (err) {
    $("q-result").hidden = false;
    showError($("q-result"), err.message);
  } finally {
    btn.disabled = false; btn.textContent = "查詢收市價";
  }
}

const round2 = (v) => Math.round(v * 100) / 100;

function renderQuote(q) {
  const el = $("q-result");
  el.hidden = false;
  const mktLabel = MARKET_LABEL[q.market] || q.market;
  const note = [
    q.note ? "📌 " + q.note : "",
    q.fx_source.startsWith("ECB") ? `匯率採用 ${q.fx_source.replace("ECB·", "")}（ECB）` : `匯率來源：${q.fx_source}`,
  ].filter(Boolean).join("；");
  el.innerHTML = `
    <div class="result-grid">
      <div class="r-cell r-name-block">
        <span class="r-k">股票</span>
        <span class="r-name-cn">${esc(q.name_cn || q.code)}<small>${esc(q.code)} · ${mktLabel}</small></span>
        ${q.name_en ? `<span class="r-name-en">${esc(q.name_en)}</span>` : ""}
      </div>
      <div class="r-cell"><span class="r-k">實際交易日</span><span class="r-v" style="font-size:16px">${q.quote_date}</span></div>
      <div class="r-cell"><span class="r-k">收市價（${q.currency}）</span><span class="r-v">${fmtMoney(q.price)}</span></div>
      ${q.shares ? `<div class="r-cell"><span class="r-k">股份數量</span><span class="r-v" style="font-size:16px">${fmtInt(q.shares)}</span></div>` : ""}
      ${q.market_value !== null ? `
        <div class="r-cell"><span class="r-k">市值（${q.currency}）</span><span class="r-v">${fmtMoney(q.market_value)}</span></div>
        <div class="r-cell"><span class="r-k">匯率（→HKD）</span><span class="r-v" style="font-size:16px">${q.fx_to_hkd.toFixed(4)}</span></div>
        <div class="r-cell hl"><span class="r-k">港幣市值</span><span class="r-v">HK$${fmtMoney(q.hkd_value)}</span></div>` : ""}
    </div>
    ${note ? `<p class="r-note">${esc(note)}。</p>` : ""}
  `;
}

/* ---------- 批量作業 ---------- */
async function submitBatch(e) {
  e.preventDefault();
  const btn = $("b-submit");
  const prog = $("b-progress");
  const file = $("b-file").files[0];
  if (!file) return;
  btn.disabled = true; btn.textContent = "處理中…";
  prog.hidden = false; prog.textContent = "正在解析 Excel…";
  $("b-result").hidden = true;
  try {
    const fallbackDate = $("b-date").value || todayStr();
    prog.textContent = "正在解析 Excel…";
    const rows = await parseExcel(file);
    // 依全檔判斷：以客戶編號或股票代碼排序
    const ordered = sortBatchRows(rows);
    prog.textContent = `正在逐行查詢真實行情（共 ${ordered.length} 行）…`;
    const results = [];
    for (let i = 0; i < ordered.length; i++) {
      const r = ordered[i];
      try {
        // 每列可用自己的指定日期；缺則退回批量日期
        const rowDate = r.date || fallbackDate;
        const q = await getClosePrice(r.code, r.market, rowDate);
        const fx = await fetchFx(q.currency, q.quote_date);
        const mv = round4(q.price * r.shares);
        results.push({
          ...r, ...q,
          date: rowDate,
          market_value: mv,
          fx_to_hkd: fx.rate, fx_source: fx.source,
          hkd_value: round4(mv * fx.rate),
          status: "ok", reason: "",
        });
      } catch (err) {
        results.push({ ...r, status: "failed", reason: err.message });
      }
      prog.textContent = `正在查詢真實行情（${i + 1}/${ordered.length}）…`;
    }
    state.lastRows = results;
    state.rowsFromDemo = false;
    prog.hidden = true;
    renderBatch(results, fallbackDate);
    $("s-source").value = "last";
    computeStats();
  } catch (err) {
    prog.hidden = true;
    $("b-result").hidden = false;
    showError($("b-result"), err.message);
  } finally {
    btn.disabled = false; btn.textContent = "上傳並計算";
  }
}

const B_COLS = [
  ["client", "客戶編號"], ["date", "指定日期"], ["market", "市場"], ["stock", "股票"], ["shares", "股份數量"],
  ["price", "收市價"], ["market_value", "原幣市值"], ["fx_to_hkd", "匯率→HKD"],
  ["hkd_value", "港幣市值"], ["status", "狀態"], ["reason", "備註"],
];

function renderBatch(rows, fallbackDate) {
  const el = $("b-result");
  el.hidden = false;
  const ok = rows.filter((r) => r.status === "ok");
  const failed = rows.length - ok.length;
  const totalHkd = ok.reduce((s, r) => s + (r.hkd_value || 0), 0);
  const uniqueDates = [...new Set(rows.map((r) => r.date || fallbackDate))];
  const dateNote = uniqueDates.length > 1
    ? `每列以「指定日期」獨立查價（本次共 ${uniqueDates.length} 個不同日期）`
    : `查詢日期：${fallbackDate}`;
  const hasClient = rows.some((r) => String(r.client || "").trim() !== "");
  const sortNote = hasClient ? "已依「客戶編號」排序" : "已依「股票代碼」排序";
  const rowsHtml = rows.map((row) => {
    const isOk = row.status === "ok";
    const cells = B_COLS.map(([k, label]) => {
      let v = row[k];
      if (k === "market") v = `<span class="tag tag-mkt">${MARKET_LABEL[v] || v}</span>`;
      if (k === "status") v = isOk ? `<span class="tag tag-ok">成功</span>` : `<span class="tag tag-fail">失敗</span>`;
      if (k === "stock") v = `<div class="stock-cell"><span class="code">${esc(row.code)}</span>${row.name_cn ? `<span class="name-cn">${esc(row.name_cn)}</span>` : ""}${row.name_en ? `<span class="name-en">${esc(row.name_en)}</span>` : ""}</div>`;
      if (k === "price" || k === "market_value" || k === "hkd_value") v = v !== null && v !== undefined ? fmtMoney(v) : "—";
      if (k === "fx_to_hkd") v = v !== null && v !== undefined ? Number(v).toFixed(4) : "—";
      if (k === "shares") v = fmtInt(v);
      if (k === "date") v = v ? esc(v) : `<span class="pf-muted">—（批量 ${esc(fallbackDate)}）</span>`;
      if (k === "client") v = v ? esc(v) : `<span class="pf-muted">—</span>`;
      if (k === "reason" && !v) v = "—";
      return `<td data-label="${escAttr(label)}">${v || ""}</td>`;
    }).join("");
    return `<tr class="${isOk ? "" : "row-fail"}">${cells}</tr>`;
  }).join("");

  el.innerHTML = `
    <div class="kpis" style="grid-template-columns:repeat(4,1fr);margin-top:0">
      <div class="kpi"><span class="kpi-label">總行數</span><span class="kpi-value" style="font-size:24px">${rows.length}</span></div>
      <div class="kpi"><span class="kpi-label">成功</span><span class="kpi-value" style="font-size:24px;color:var(--green)">${ok.length}</span></div>
      <div class="kpi"><span class="kpi-label">失敗</span><span class="kpi-value" style="font-size:24px;color:${failed ? "var(--red)" : "var(--text)"}">${failed}</span></div>
      <div class="kpi kpi-hl"><span class="kpi-label">港幣市值合計</span><span class="kpi-value" style="font-size:24px">HK$${fmtMoney(totalHkd)}</span></div>
    </div>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>客戶編號</th><th>指定日期</th><th>市場</th><th>股票</th><th>股份數量</th><th>收市價</th><th>原幣市值</th><th>匯率→HKD</th><th>港幣市值</th><th>狀態</th><th>備註</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table></div>
    <div style="display:flex;gap:16px;margin-top:20px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-dark" type="button" id="b-export-btn">⬇ 匯出結果（Excel）</button>
      <span class="r-note" style="margin:0">${dateNote}；${sortNote}；失敗行原因見備註。</span>
    </div>
  `;
  $("b-export-btn").addEventListener("click", () => {
    if (state.lastRows) exportResults(state.lastRows);
  });
}

/* ---------- 回贈計算（純 JS） ---------- */
function computeRebates(rows, cap, threshold, amount) {
  const clientMV = {};
  const marketDist = {};
  const stockMV = {};
  rows.forEach((r) => {
    if (r.status !== "ok") return;
    const cid = String(r.client || "").trim() || "未知客戶";
    const mv = Number(r.hkd_value) || 0;
    clientMV[cid] = (clientMV[cid] || 0) + mv;
    const mkt = r.market || "?";
    marketDist[mkt] = (marketDist[mkt] || 0) + mv;
    const sk = `${r.market}|${r.code}`;
    stockMV[sk] = (stockMV[sk] || 0) + mv;
  });
  const clientList = Object.entries(clientMV).map(([client, mv]) => {
    const raw = threshold > 0 ? Math.floor(mv / threshold) * amount : 0;
    const rebate = cap > 0 ? Math.min(raw, cap) : raw;
    return { client, market_value: round2(mv), rebate: round2(rebate) };
  }).sort((a, b) => b.market_value - a.market_value);

  const totalMV = round2(clientList.reduce((s, c) => s + c.market_value, 0));
  const totalRebate = round2(clientList.reduce((s, c) => s + c.rebate, 0));
  const clientCount = clientList.length;
  const avgMV = clientCount ? round2(totalMV / clientCount) : 0;

  const stockTop3 = Object.entries(stockMV)
    .map(([key, value]) => { const [market, code] = key.split("|"); return { market, code, value: round2(value) }; })
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  return {
    total_rebate: totalRebate,
    client_count: clientCount,
    total_mv_hkd: totalMV,
    avg_mv_hkd: avgMV,
    top3: clientList.slice(0, 3).map((c) => ({ client: c.client, market_value: c.market_value })),
    stock_top3: stockTop3,
    market_distribution: Object.entries(marketDist)
      .map(([market, value]) => ({ market, value: round2(value) }))
      .sort((a, b) => b.value - a.value),
    rebate_by_client: clientList,
  };
}

/* ---------- 統計 ---------- */
async function computeStats() {
  const submitBtn = $("s-submit");
  if (!submitBtn.disabled) submitBtn.disabled = true;
  $("s-loading").hidden = false;
  $("s-error").hidden = true;
  $("s-kpis").hidden = true;
  $("s-charts").hidden = true;
  $("s-note").hidden = true;
  try {
    const cap = parseFloat($("s-cap").value) || 0;
    const threshold = parseFloat($("s-threshold").value) || 100000;
    const amount = parseFloat($("s-amount").value) || 0;
    let rows;
    if ($("s-source").value === "last" && state.lastRows) {
      rows = state.lastRows;
    } else {
      const date = $("s-date").value || todayStr();
      $("s-loading").textContent = `正在載入 ${date} 真實行情…`;
      rows = await buildDemoRows(date);
      state.rowsFromDemo = true;
    }
    const st = computeRebates(rows, cap, threshold, amount);
    renderStats(st, rows);
  } catch (err) {
    $("s-error").hidden = false;
    showError($("s-error"), err.message);
  } finally {
    $("s-loading").hidden = true;
    submitBtn.disabled = false;
  }
}

function renderStats(st, rows) {
  $("s-kpis").hidden = false;
  $("s-charts").hidden = false;
  $("k-total").textContent = "HK$" + fmtMoney(st.total_rebate);
  $("k-clients").textContent = fmtInt(st.client_count);
  $("k-avg").textContent = "HK$" + fmtMoney(st.avg_mv_hkd);
  $("k-total-mv").textContent = "HK$" + fmtMoney(st.total_mv_hkd);

  renderTop3("chartTop3", st.stock_top3);
  renderTop3Cards(st.stock_top3, st.total_mv_hkd);
  renderMarket("chartMarket", st.market_distribution);
  renderRebate("chartRebate", st.rebate_by_client);

  const p = { cap: parseFloat($("s-cap").value) || 0, threshold: parseFloat($("s-threshold").value) || 100000, amount: parseFloat($("s-amount").value) || 0 };
  $("s-note").hidden = false;
  $("s-note").textContent =
    `條件：每 ${fmtInt(p.threshold)} 港幣回贈 ${fmtMoney(p.amount)} 元，每人上限 ${fmtMoney(p.cap)} 元。` +
    `統計基於${state.rowsFromDemo ? "演示持倉（真實行情）" : "最近一次批量結果"}，成功 ${rows.filter((r) => r.status === "ok").length} 行。`;
  setTimeout(resizeCharts, 80);
}

/* ---------- 持倉市值 Top 3 卡片（Logo + 公司名 + 排名 + 倉位比重） ---------- */
function renderTop3Cards(list, totalMv) {
  const box = $("top3-cards");
  if (!box) return;
  if (!list || !list.length) { box.innerHTML = ""; return; }
  box.innerHTML = list.map((d, i) => {
    const info = (typeof hkLogoInfo === "function") ? hkLogoInfo(d.code) : null;
    const cn = info ? info.cn : d.code;
    const en = info ? info.en : "";
    const monoChar = info ? (info.mono || d.code.slice(0, 1)) : d.code.slice(0, 1);
    const hasLogo = !!info;
    const rank = i + 1;
    const w = totalMv ? (d.value / totalMv) * 100 : 0;
    const wPct = w.toFixed(1);
    return `
      <div class="top3-card">
        <span class="top3-rank">#${rank}</span>
        <span class="top3-badge">
          ${hasLogo ? `<img class="top3-logo" src="img/logos/${info.key}.png" alt="${esc(cn)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ""}
          <span class="top3-mono" style="display:${hasLogo ? "none" : "flex"}">${esc(monoChar)}</span>
        </span>
        <div class="top3-info">
          <div class="top3-name">${esc(cn)}${en ? ` <span class="top3-en">${esc(en)}</span>` : ""}</div>
          <div class="top3-sub">${(MARKET_LABEL[d.market] || d.market)} · ${esc(d.code)}</div>
        </div>
        <div class="top3-weight">
          <span class="top3-w-val">${wPct}%</span>
          <span class="top3-w-bar"><i style="width:${wPct}%"></i></span>
        </div>
      </div>`;
  }).join("");
}

/* ---------- 初始化 ---------- */
function init() {
  const today = todayStr();
  $("q-date").value = today;
  $("b-date").value = today;
  $("s-date").value = today;

  $("quote-form").addEventListener("submit", submitQuote);
  $("batch-form").addEventListener("submit", submitBatch);
  $("stats-form").addEventListener("submit", (e) => { e.preventDefault(); computeStats(); });
  $("dl-template").addEventListener("click", downloadTemplate);

  initReveal();
  computeStats();
}

document.addEventListener("DOMContentLoaded", init);
