/* ================= Nora-AI Capital · 主邏輯（純前端） ================= */
"use strict";

const $ = (id) => document.getElementById(id);
const state = { rows: [], rowsFromDemo: true, lastRows: null };

/* 動態內容快取：語言切換時用這些快取重渲染（見 init 的 I18N.registerDynamic） */
let lastQuote = null, lastBatch = null, lastBatchDate = null, lastStats = null, lastStatsRows = null;

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
  btn.disabled = true; btn.textContent = I18N.t("app.quote.btnLoading");
  $("q-result").hidden = true;
  try {
    const code = $("q-code").value.trim();
    const market = $("q-market").value;
    const date = $("q-date").value;
    if (!code || !date) throw new Error(I18N.t("app.quote.errFill"));
    const q = await getClosePrice(code, market, date);
    const shares = parseFloat($("q-shares").value);
    const fx = await fetchFx(q.currency, q.quote_date);
    const mv = shares > 0 ? round2(q.price * shares) : null;
    const hkd = mv !== null ? round2(mv * fx.rate) : null;
    const result = { ...q, shares: shares > 0 ? shares : null, market_value: mv, fx_to_hkd: fx.rate, hkd_value: hkd, fx_source: fx.source };
    renderQuote(result);
    lastQuote = result;
  } catch (err) {
    $("q-result").hidden = false;
    showError($("q-result"), err.message);
  } finally {
    btn.disabled = false; btn.textContent = I18N.t("app.quote.btnLabel");
  }
}

const round2 = (v) => Math.round(v * 100) / 100;

function renderQuote(q) {
  const el = $("q-result");
  el.hidden = false;
  const mktLabel = MARKET_LABEL(q.market) || q.market;
  const noteParts = [];
  if (q.note) noteParts.push("📌 " + I18N.t("data.note.nonTrade"));
  if (q.fx_source.indexOf("ECB") === 0) {
    noteParts.push(I18N.t("app.quote.note.ecb", { date: q.fx_source.replace("ECB·", "") }));
  } else {
    noteParts.push(I18N.t("app.quote.note.fxSrc", { src: q.fx_source }));
  }
  const note = noteParts.filter(Boolean).join(I18N.t("app.quote.note.sep"));
  el.innerHTML = `
    <div class="result-grid">
      <div class="r-cell r-name-block">
        <span class="r-k">${I18N.t("app.quote.lbl.stock")}</span>
        <span class="r-name-cn">${esc(q.name_cn || q.code)}<small>${esc(q.code)} · ${mktLabel}</small></span>
        ${q.name_en ? `<span class="r-name-en">${esc(q.name_en)}</span>` : ""}
      </div>
      <div class="r-cell"><span class="r-k">${I18N.t("app.quote.lbl.tradeDate")}</span><span class="r-v" style="font-size:16px">${q.quote_date}</span></div>
      <div class="r-cell"><span class="r-k">${I18N.t("app.quote.lbl.price", { cur: q.currency })}</span><span class="r-v">${fmtMoney(q.price)}</span></div>
      ${q.shares ? `<div class="r-cell"><span class="r-k">${I18N.t("app.quote.lbl.shares")}</span><span class="r-v" style="font-size:16px">${fmtInt(q.shares)}</span></div>` : ""}
      ${q.market_value !== null ? `
        <div class="r-cell"><span class="r-k">${I18N.t("app.quote.lbl.mv", { cur: q.currency })}</span><span class="r-v">${fmtMoney(q.market_value)}</span></div>
        <div class="r-cell"><span class="r-k">${I18N.t("app.quote.lbl.fx")}</span><span class="r-v" style="font-size:16px">${q.fx_to_hkd.toFixed(4)}</span></div>
        <div class="r-cell hl"><span class="r-k">${I18N.t("app.quote.lbl.hkdMv")}</span><span class="r-v">HK$${fmtMoney(q.hkd_value)}</span></div>` : ""}
    </div>
    ${note ? `<p class="r-note">${esc(note)}${I18N.t("app.quote.note.end")}</p>` : ""}
  `;
}

/* ---------- 批量作業 ---------- */

/* 依檔案是否有指定日期，切換頂部「批量日期」欄位為可用或鎖定。
   只要檔案任一列有指定日期 → 鎖定批量日期以避免誤改影響結果。 */
function setBatchDateFieldState(locked) {
  const el = $("b-date");
  const hint = $("bDateHint");
  if (!el) return;
  el.disabled = !!locked;
  el.classList.toggle("field-locked", !!locked);
  if (hint) {
    hint.style.display = locked ? "inline" : "none";
    const bubble = hint.querySelector(".tip-bubble");
    if (bubble) bubble.textContent = locked
      ? I18N.t("app.batch.lockedTip")
      : "";
  }
}

/* 當使用者重新挑選檔案時，把批量日期欄位重新啟用（等新檔解析後由 submitBatch 再決定） */
function handleBatchFileChange() {
  const file = $("b-file").files[0];
  if (!file) return;
  setBatchDateFieldState(false); // 預設解鎖，等解析後再判定
  $("b-result").hidden = true;
}

async function submitBatch(e) {
  e.preventDefault();
  const btn = $("b-submit");
  const prog = $("b-progress");
  const file = $("b-file").files[0];
  if (!file) return;
  btn.disabled = true; btn.textContent = I18N.t("app.batch.btnLoading");
  prog.hidden = false; prog.textContent = I18N.t("app.batch.parsing");
  $("b-result").hidden = true;
  try {
    const fallbackDate = $("b-date").value || todayStr();
    prog.textContent = I18N.t("app.batch.parsing");
    const rows = await parseExcel(file);
    /* 檔案若有任一列指定日期 → 鎖定頂部「批量日期」（避免誤改影響未指定列） */
    const fileHasDates = rows.some((r) => !!r.date);
    setBatchDateFieldState(fileHasDates);
    // 依全檔判斷：以客戶編號或股票代碼排序
    const ordered = sortBatchRows(rows);
    prog.textContent = I18N.t("app.batch.querying", { n: ordered.length });
    const results = [];
    for (let i = 0; i < ordered.length; i++) {
      const r = ordered[i];
      try {
        // 每列可用自己的指定日期；缺則退回批量日期
        const rowDate = r.date || fallbackDate;
        const q = await getClosePrice(r.code, r.market, rowDate);
        // 匯率使用「指定日期」（用戶要求）；若該日 ECB 拿不到，fallback 到實際交易日
        let fx;
        try {
          fx = await fetchFx(q.currency, rowDate);
        } catch (_) {
          fx = await fetchFx(q.currency, q.quote_date);
        }
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
      prog.textContent = I18N.t("app.batch.queryProg", { i: i + 1, n: ordered.length });
    }
    state.lastRows = results;
    state.rowsFromDemo = false;
    prog.hidden = true;
    renderBatch(results, fallbackDate);
    lastBatch = results;
    lastBatchDate = fallbackDate;
    $("s-source").value = "last";
    computeStats();
  } catch (err) {
    prog.hidden = true;
    $("b-result").hidden = false;
    showError($("b-result"), err.message);
  } finally {
    btn.disabled = false; btn.textContent = I18N.t("app.batch.btn");
  }
}

const B_COLS = [
  ["client", "app.batch.col.client"], ["date", "app.batch.col.date"], ["market", "app.batch.col.market"], ["stock", "app.batch.col.stock"], ["shares", "app.batch.col.shares"],
  ["price", "app.batch.col.price"], ["market_value", "app.batch.col.mv"], ["fx_to_hkd", "app.batch.col.fx"],
  ["hkd_value", "app.batch.col.hkdMv"], ["status", "app.batch.col.status"], ["reason", "app.batch.col.reason"],
];

function renderBatch(rows, fallbackDate) {
  const el = $("b-result");
  el.hidden = false;
  const ok = rows.filter((r) => r.status === "ok");
  const failed = rows.length - ok.length;
  const totalHkd = ok.reduce((s, r) => s + (r.hkd_value || 0), 0);
  const uniqueDates = [...new Set(rows.map((r) => r.date || fallbackDate))];
  const dateNote = uniqueDates.length > 1
    ? I18N.t("app.batch.dateNote.multi", { n: uniqueDates.length })
    : I18N.t("app.batch.dateNote.single", { date: fallbackDate });
  const hasClient = rows.some((r) => String(r.client || "").trim() !== "");
  const sortNote = hasClient ? I18N.t("app.batch.sortByClient") : I18N.t("app.batch.sortByStock");
  const tailParts = [dateNote, sortNote];
  if (failed) tailParts.push(I18N.t("app.batch.failNote", { n: failed }));
  const tail = tailParts.join(I18N.t("app.batch.sep"));
  const rowsHtml = rows.map((row) => {
    const isOk = row.status === "ok";
    const cells = B_COLS.map(([k, labelKey]) => {
      const label = I18N.t(labelKey);
      let v = row[k];
      if (k === "market") v = `<span class="tag tag-mkt">${MARKET_LABEL(v) || v}</span>`;
      if (k === "status") v = isOk ? `<span class="tag tag-ok">${I18N.t("app.batch.status.ok")}</span>` : `<span class="tag tag-fail">${I18N.t("app.batch.status.fail")}</span>`;
      if (k === "stock") v = `<div class="stock-cell"><span class="code">${esc(row.code)}</span>${row.name_cn ? `<span class="name-cn">${esc(row.name_cn)}</span>` : ""}${row.name_en ? `<span class="name-en">${esc(row.name_en)}</span>` : ""}</div>`;
      if (k === "price" || k === "market_value" || k === "hkd_value") v = v !== null && v !== undefined ? fmtMoney(v) : "—";
      if (k === "fx_to_hkd") v = v !== null && v !== undefined ? Number(v).toFixed(4) : "—";
      if (k === "shares") v = fmtInt(v);
      if (k === "date") v = v ? esc(v) : `<span class="pf-muted">—（${I18N.t("batch.lbl.date")} ${esc(fallbackDate)}）</span>`;
      if (k === "client") v = v ? esc(v) : `<span class="pf-muted">—</span>`;
      if (k === "reason" && !v) v = "—";
      return `<td data-label="${escAttr(label)}">${v || ""}</td>`;
    }).join("");
    return `<tr class="${isOk ? "" : "row-fail"}">${cells}</tr>`;
  }).join("");

  el.innerHTML = `
    <div class="kpis" style="grid-template-columns:repeat(4,1fr);margin-top:0">
      <div class="kpi"><span class="kpi-label">${I18N.t("app.batch.kpi.total")}</span><span class="kpi-value" style="font-size:24px">${rows.length}</span></div>
      <div class="kpi"><span class="kpi-label">${I18N.t("app.batch.kpi.ok")}</span><span class="kpi-value" style="font-size:24px;color:var(--green)">${ok.length}</span></div>
      <div class="kpi"><span class="kpi-label">${I18N.t("app.batch.kpi.fail")}</span><span class="kpi-value" style="font-size:24px;color:${failed ? "var(--red)" : "var(--text)"}">${failed}</span></div>
      <div class="kpi kpi-hl"><span class="kpi-label">${I18N.t("app.batch.kpi.totalMv")}</span><span class="kpi-value" style="font-size:24px">HK$${fmtMoney(totalHkd)}</span></div>
    </div>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>${I18N.t("app.batch.col.client")}</th><th>${I18N.t("app.batch.col.date")}</th><th>${I18N.t("app.batch.col.market")}</th><th>${I18N.t("app.batch.col.stock")}</th><th>${I18N.t("app.batch.col.shares")}</th><th>${I18N.t("app.batch.col.price")}</th><th>${I18N.t("app.batch.col.mv")}</th><th>${I18N.t("app.batch.col.fx")}</th><th>${I18N.t("app.batch.col.hkdMv")}</th><th>${I18N.t("app.batch.col.status")}</th><th>${I18N.t("app.batch.col.reason")}</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table></div>
    <div class="b-export-row">
      <button class="btn btn-dark" type="button" id="b-export-btn">${I18N.t("app.batch.exportBtn")}</button>
      <span class="r-note" style="margin:0">${tail}</span>
      <span class="r-note r-note-fx" style="margin:0">${I18N.t("app.batch.fxNote")}</span>
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
      $("s-loading").textContent = I18N.t("app.stats.loadingDate", { date });
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
  const demoLabel = state.rowsFromDemo ? I18N.t("app.stats.note.demo") : I18N.t("app.stats.note.last");
  $("s-note").hidden = false;
  $("s-note").textContent = I18N.t("app.stats.note", {
    threshold: fmtInt(p.threshold),
    amount: fmtMoney(p.amount),
    cap: fmtMoney(p.cap),
    demo: demoLabel,
    ok: rows.filter((r) => r.status === "ok").length,
  });
  lastStats = st;
  lastStatsRows = rows;
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
          <div class="top3-sub">${(MARKET_LABEL(d.market) || d.market)} · ${esc(d.code)}</div>
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
  /* 重新挑檔時先把批量日期欄位解鎖，等解析後再判定 */
  $("b-file").addEventListener("change", handleBatchFileChange);

  initReveal();
  computeStats();

  /* 語言切換時重渲染動態內容（結果表格 / 圖表 / KPI / 持倉表） */
  I18N.registerDynamic(function () {
    if (lastQuote) renderQuote(lastQuote);
    if (lastBatch) renderBatch(lastBatch, lastBatchDate);
    if (lastStats) renderStats(lastStats, lastStatsRows);
  });
}

document.addEventListener("DOMContentLoaded", init);
