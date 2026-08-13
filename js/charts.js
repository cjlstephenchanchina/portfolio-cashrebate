/* ================= 圖表渲染（ECharts）— 精簡數據儀表板 ================= */
"use strict";
/* 深色（dark）調色盤：淺色文字、深色 tooltip、白色 grid/axis（CodeNest 深色主題） */
const NIGHT_PALETTE = {
  text: "#FFFFFF",
  muted: "#A6B0AA",
  faint: "rgba(255, 255, 255, 0.4)",
  ink: "#FFFFFF",
  gray: "#A6B0AA",
  accent: "#5ED29C",
  accentHi: "#86E3B8",
  accentDeep: "#2E7D5C",
  up: "#FF5B6E",
  down: "#1FC79B",
  grid: "rgba(255,255,255,0.07)",
  axis: "rgba(255,255,255,0.12)",
  tooltipBg: "rgba(7, 11, 10, 0.96)",
  tooltipBorder: "rgba(94, 210, 156, 0.4)",
  tooltipShadow: "0 18px 40px rgba(0,0,0,0.5)",
  pieBorder: "rgba(255,255,255,0.08)",
  zoomBg: "rgba(255,255,255,0.04)",
  zoomFiller: "rgba(94,210,156,0.2)",
  areaTop: "rgba(94,210,156,0.30)",
  areaBottom: "rgba(94,210,156,0.02)",
};

/* 全站僅保留深夜（dark）調色盤（白天模式已移除） */
let CHART_COLORS = { ...NIGHT_PALETTE };

/* MARKET_LABEL 已移至 i18n.js（語言感知函式），此處不再重複定義 */

const fmtMoney = (v) => {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return Number(v).toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
/* 金額 HTML 版：小數點後兩位用小一號字（<span class="dec">） */
const fmtMoneyHtml = (v) => {
  const s = fmtMoney(v);
  const i = s.lastIndexOf(".");
  return i >= 0 ? `${s.slice(0, i)}<span class="dec">${s.slice(i)}</span>` : s;
};
const fmtInt = (v) => Number(v || 0).toLocaleString("zh-HK");

/* 窄屏偵測：ECharts 在 ≤640px 時縮小字號 / 旋轉軸標籤 / 加大柱寬以避免標籤擠壓重疊 */
const IS_MOBILE = () => window.matchMedia("(max-width: 640px)").matches;

function chartBase() {
  const C = CHART_COLORS;
  return {
    backgroundColor: "transparent",
    textStyle: { color: C.text, fontFamily: "Inter, system-ui, sans-serif", fontSize: 12 },
    grid: { left: 10, right: 26, top: 22, bottom: 6, containLabel: true },
    tooltip: {
      backgroundColor: C.tooltipBg,
      borderColor: C.tooltipBorder,
      borderWidth: 1,
      textStyle: { color: C.text, fontSize: 12.5 },
      extraCssText: "box-shadow: " + C.tooltipShadow + "; border-radius: 10px;",
    },
  };
}

let chartInstances = {};
/* 各圖表最近一次繪製的資料快取：主題切換時以新調色盤重繪 */
const chartCache = { top3: null, market: null, rebate: null, curve: null, kline: null };

function initChart(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  if (!chartInstances[id]) chartInstances[id] = echarts.init(el, null, { renderer: "canvas" });
  return chartInstances[id];
}

function resizeCharts() {
  Object.values(chartInstances).forEach((c) => c && c.resize());
}
window.addEventListener("resize", resizeCharts);

/* Top 3 — 橫向條形（藍調） */
function renderTop3(id, data) {
  const chart = initChart(id);
  if (!chart) return;
  chartCache.top3 = { id, data };
  const labels = (data || []).map((d) => {
    const info = (typeof hkLogoInfo === "function") ? hkLogoInfo(d.code) : null;
    return info && info.cn ? info.cn : `${d.code} · ${MARKET_LABEL(d.market) || d.market}`;
  });
  const values = (data || []).map((d) => d.value);
  chart.setOption({
    ...chartBase(),
    grid: { left: 10, right: 104, top: 22, bottom: 6, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: {
        color: CHART_COLORS.muted,
        formatter: (v) => v >= 1e12 ? (v / 1e12) + "萬億" : v >= 1e8 ? (v / 1e8) + "億" : v >= 1e4 ? (v / 1e4) + "萬" : v,
      },
      splitLine: { lineStyle: { color: CHART_COLORS.grid } },
    },
    yAxis: {
      type: "category", data: labels, inverse: true,   /* 最大市值排最上方（第一個） */
      axisLabel: { color: CHART_COLORS.text, fontSize: 13, fontWeight: 500 },
      axisLine: { show: false }, axisTick: { show: false },
    },
    series: [{
      type: "bar", data: values, barWidth: IS_MOBILE() ? 12 : 18,
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: CHART_COLORS.accentDeep }, { offset: 1, color: CHART_COLORS.accent },
        ]),
      },
      label: {
        show: true, position: "right", color: CHART_COLORS.accentHi, fontWeight: 500,
        fontSize: IS_MOBILE() ? 10 : 12,
        formatter: (p) => {
          const v = p.value;
          if (v >= 1e12) return "HK$" + (v / 1e12).toFixed(2) + "萬億";
          if (v >= 1e8) return "HK$" + (v / 1e8).toFixed(2) + "億";
          if (v >= 1e4) return "HK$" + (v / 1e4).toFixed(2) + "萬";
          return "HK$" + fmtMoney(v);
        },
      },
    }],
  }, true);
}

/* 市場分佈 — donut */
function renderMarket(id, data) {
  const chart = initChart(id);
  if (!chart) return;
  chartCache.market = { id, data };
  /* 按市場指定語義色：港股綠、A股紅、美股藍 */
  const mktColor = (m) => {
    if (m === "US") return "#3B82F6";       // 美股藍色
    if (m === "A") return CHART_COLORS.up;  // A股紅
    return CHART_COLORS.down;               // 港股綠（預設）
  };
  chart.setOption({
    ...chartBase(),
    tooltip: {
      ...chartBase().tooltip,
      formatter: (p) => `${p.name}<br/><b>HK$${fmtMoneyHtml(p.value)}</b>（${p.percent}%）`,
    },
    series: [{
      type: "pie", radius: ["52%", "76%"], center: ["50%", "52%"],
      avoidLabelOverlap: true, itemStyle: { borderRadius: 4, borderColor: CHART_COLORS.pieBorder, borderWidth: 2 },
      label: { color: CHART_COLORS.text, fontSize: 12.5, formatter: "{b}\n{c}" },
      labelLine: { lineStyle: { color: CHART_COLORS.muted } },
      data: (data || []).map((d) => ({
        name: MARKET_LABEL(d.market) || d.market, value: d.value,
        itemStyle: { color: mktColor((d.market || "").toUpperCase()) },
      })),
    }],
  }, true);
}

/* 各客戶回贈 — 柱狀（藍綠漸變） */
function renderRebate(id, data) {
  const chart = initChart(id);
  if (!chart) return;
  chartCache.rebate = { id, data };
  const clients = (data || []).map((d) => d.client);
  const rebates = (data || []).map((d) => d.rebate);
  chart.setOption({
    ...chartBase(),
    xAxis: {
      type: "category", data: clients,
      axisLabel: { color: CHART_COLORS.muted, fontSize: IS_MOBILE() ? 10 : 12, rotate: IS_MOBILE() ? 35 : 0 },
      axisLine: { lineStyle: { color: CHART_COLORS.axis } }, axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: CHART_COLORS.muted },
      splitLine: { lineStyle: { color: CHART_COLORS.grid } },
    },
    series: [{
      type: "bar", data: rebates, barWidth: IS_MOBILE() ? "55%" : "42%",
      itemStyle: {
        borderRadius: [6, 6, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: CHART_COLORS.accent }, { offset: 1, color: CHART_COLORS.down },
        ]),
      },
      label: {
        show: true, position: "top", color: CHART_COLORS.accentHi, fontWeight: 500,
        fontSize: IS_MOBILE() ? 10 : 12,
        formatter: (p) => "HK$" + fmtMoney(p.value),   /* Canvas 標籤：純文字，不可含 HTML */
      },
    }],
  }, true);
}

/* ---------- 組合淨值走勢（折線） ---------- */
function renderPortfolioCurve(id, series) {
  const chart = initChart(id);
  if (!chart) return;
  chartCache.curve = { id, data: series };
  const dates = (series || []).map((p) => p[0]);
  const values = (series || []).map((p) => Math.round(p[1]));
  chart.setOption({
    ...chartBase(),
    grid: { left: 10, right: 22, top: 18, bottom: 24, containLabel: true },
    tooltip: {
      ...chartBase().tooltip, trigger: "axis",
      formatter: (ps) => {
        const p = ps[0];
        return `${p.axisValue}<br/><b>HK$${fmtMoneyHtml(p.value)}</b>`;
      },
    },
    xAxis: {
      type: "category", data: dates, boundaryGap: false,
      axisLabel: { color: CHART_COLORS.muted, fontSize: IS_MOBILE() ? 9 : 11, hideOverlap: true, rotate: IS_MOBILE() ? 35 : 0 },
      axisLine: { lineStyle: { color: CHART_COLORS.axis } }, axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: CHART_COLORS.muted, formatter: (v) => (v >= 1e6 ? (v / 1e6) + "M" : v >= 1e4 ? (v / 1e4) + "萬" : v) },
      splitLine: { lineStyle: { color: CHART_COLORS.grid } },
    },
    dataZoom: [{ type: "inside" }, { type: "slider", height: 16, bottom: 2, borderColor: "transparent", backgroundColor: CHART_COLORS.zoomBg, fillerColor: CHART_COLORS.zoomFiller, textStyle: { color: CHART_COLORS.muted } }],
    series: [{
      type: "line", data: values, smooth: true, showSymbol: false,
      lineStyle: { color: CHART_COLORS.accent, width: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: CHART_COLORS.areaTop }, { offset: 1, color: CHART_COLORS.areaBottom },
        ]),
      },
    }],
  }, true);
}

/* ---------- 日 K 線（蠟燭圖，漲紅跌綠） ---------- */
function renderKline(id, data, title) {
  const chart = initChart(id);
  if (!chart) return;
  chartCache.kline = { id, data };
  const dates = (data || []).map((b) => b[0]);
  const kdata = (data || []).map((b) => [b[1], b[2], b[4], b[3]]); // [open, close, low, high]
  chart.setOption({
    ...chartBase(),
    grid: { left: 10, right: 18, top: 18, bottom: 24, containLabel: true },
    tooltip: { ...chartBase().tooltip, trigger: "axis", axisPointer: { type: "cross" } },
    xAxis: {
      type: "category", data: dates, boundaryGap: false,
      axisLabel: { color: CHART_COLORS.muted, fontSize: IS_MOBILE() ? 9 : 11, hideOverlap: true, rotate: IS_MOBILE() ? 35 : 0 },
      axisLine: { lineStyle: { color: CHART_COLORS.axis } }, axisTick: { show: false },
    },
    yAxis: {
      type: "value", scale: true,
      axisLabel: { color: CHART_COLORS.muted },
      splitLine: { lineStyle: { color: CHART_COLORS.grid } },
    },
    dataZoom: [{ type: "inside" }, { type: "slider", height: 16, bottom: 2, borderColor: "transparent", backgroundColor: CHART_COLORS.zoomBg, fillerColor: CHART_COLORS.zoomFiller, textStyle: { color: CHART_COLORS.muted } }],
    series: [{
      type: "candlestick", data: kdata,
      itemStyle: {
        color: CHART_COLORS.up, color0: CHART_COLORS.down,
        borderColor: CHART_COLORS.up, borderColor0: CHART_COLORS.down,
      },
    }],
  }, true);
  if (title) { /* 標題由外部 DOM 控制 */ }
}

/* ---------- 主題切換：以新調色盤重繪所有既有圖表 ---------- */
function applyChartTheme() {
  CHART_COLORS = { ...NIGHT_PALETTE };
  const c = chartCache;
  if (c.top3) renderTop3(c.top3.id, c.top3.data);
  if (c.market) renderMarket(c.market.id, c.market.data);
  if (c.rebate) renderRebate(c.rebate.id, c.rebate.data);
  if (c.curve) renderPortfolioCurve(c.curve.id, c.curve.data);
  if (c.kline) renderKline(c.kline.id, c.kline.data);
}
window.applyChartTheme = applyChartTheme;
