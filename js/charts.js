/* ================= 圖表渲染（ECharts）— 精簡數據儀表板 ================= */
"use strict";
const CHART_COLORS = {
  text: "#E7EAF0",
  muted: "#8A93A6",
  faint: "rgba(231, 234, 240, 0.4)",
  ink: "#FFFFFF",
  gray: "#8A93A6",
  accent: "#5B8DEF",
  accentHi: "#7AA4F4",
  accentDeep: "#2C4F8F",
  up: "#FF5B6E",
  down: "#1FC79B",
  grid: "rgba(255,255,255,0.07)",
  axis: "rgba(255,255,255,0.12)",
};

/* MARKET_LABEL 已移至 i18n.js（語言感知函式），此處不再重複定義 */

const fmtMoney = (v) => {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return Number(v).toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtInt = (v) => Number(v || 0).toLocaleString("zh-HK");

/* 窄屏偵測：ECharts 在 ≤640px 時縮小字號 / 旋轉軸標籤 / 加大柱寬以避免標籤擠壓重疊 */
const IS_MOBILE = () => window.matchMedia("(max-width: 640px)").matches;

const CHART_BASE = {
  backgroundColor: "transparent",
  textStyle: { color: CHART_COLORS.text, fontFamily: "Inter, system-ui, sans-serif", fontSize: 12 },
  grid: { left: 10, right: 26, top: 22, bottom: 6, containLabel: true },
  tooltip: {
    backgroundColor: "rgba(17, 21, 31, 0.96)",
    borderColor: "rgba(91, 141, 239, 0.4)",
    borderWidth: 1,
    textStyle: { color: CHART_COLORS.text, fontSize: 12.5 },
    extraCssText: "box-shadow: 0 18px 40px rgba(0,0,0,0.5); border-radius: 10px;",
  },
};

let chartInstances = {};

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
  const labels = (data || []).map((d) => {
    const info = (typeof hkLogoInfo === "function") ? hkLogoInfo(d.code) : null;
    return info && info.cn ? info.cn : `${d.code} · ${MARKET_LABEL(d.market) || d.market}`;
  });
  const values = (data || []).map((d) => d.value);
  chart.setOption({
    ...CHART_BASE,
    xAxis: {
      type: "value",
      axisLabel: { color: CHART_COLORS.muted, formatter: (v) => (v >= 1e6 ? (v / 1e6) + "M" : v >= 1e4 ? (v / 1e4) + "萬" : v) },
      splitLine: { lineStyle: { color: CHART_COLORS.grid } },
    },
    yAxis: {
      type: "category", data: labels,
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
        formatter: (p) => "HK$" + fmtMoney(p.value),
      },
    }],
  }, true);
}

/* 市場分佈 — donut */
function renderMarket(id, data) {
  const chart = initChart(id);
  if (!chart) return;
  const palette = [CHART_COLORS.accent, CHART_COLORS.down, CHART_COLORS.up,
                   CHART_COLORS.accentHi, "#9AA6C0"];
  chart.setOption({
    ...CHART_BASE,
    tooltip: {
      ...CHART_BASE.tooltip,
      formatter: (p) => `${p.name}<br/><b>HK$${fmtMoney(p.value)}</b>（${p.percent}%）`,
    },
    series: [{
      type: "pie", radius: ["52%", "76%"], center: ["50%", "52%"],
      avoidLabelOverlap: true, itemStyle: { borderRadius: 4, borderColor: "rgba(255,255,255,0.08)", borderWidth: 2 },
      label: { color: CHART_COLORS.text, fontSize: 12.5, formatter: "{b}\n{c}" },
      labelLine: { lineStyle: { color: CHART_COLORS.muted } },
      data: (data || []).map((d, i) => ({
        name: MARKET_LABEL(d.market) || d.market, value: d.value,
        itemStyle: { color: palette[i % palette.length] },
      })),
    }],
  }, true);
}

/* 各客戶回贈 — 柱狀（藍綠漸變） */
function renderRebate(id, data) {
  const chart = initChart(id);
  if (!chart) return;
  const clients = (data || []).map((d) => d.client);
  const rebates = (data || []).map((d) => d.rebate);
  chart.setOption({
    ...CHART_BASE,
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
        formatter: (p) => "HK$" + fmtMoney(p.value),
      },
    }],
  }, true);
}

/* ---------- 組合淨值走勢（折線） ---------- */
function renderPortfolioCurve(id, series) {
  const chart = initChart(id);
  if (!chart) return;
  const dates = (series || []).map((p) => p[0]);
  const values = (series || []).map((p) => Math.round(p[1]));
  chart.setOption({
    ...CHART_BASE,
    grid: { left: 10, right: 22, top: 18, bottom: 24, containLabel: true },
    tooltip: {
      ...CHART_BASE.tooltip, trigger: "axis",
      formatter: (ps) => {
        const p = ps[0];
        return `${p.axisValue}<br/><b>HK$${fmtMoney(p.value)}</b>`;
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
    dataZoom: [{ type: "inside" }, { type: "slider", height: 16, bottom: 2, borderColor: "transparent", backgroundColor: "rgba(255,255,255,0.04)", fillerColor: "rgba(91,141,239,0.2)", textStyle: { color: CHART_COLORS.muted } }],
    series: [{
      type: "line", data: values, smooth: true, showSymbol: false,
      lineStyle: { color: CHART_COLORS.accent, width: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "rgba(91,141,239,0.30)" }, { offset: 1, color: "rgba(91,141,239,0.02)" },
        ]),
      },
    }],
  }, true);
}

/* ---------- 日 K 線（蠟燭圖，漲紅跌綠） ---------- */
function renderKline(id, data, title) {
  const chart = initChart(id);
  if (!chart) return;
  const dates = (data || []).map((b) => b[0]);
  const kdata = (data || []).map((b) => [b[1], b[2], b[4], b[3]]); // [open, close, low, high]
  chart.setOption({
    ...CHART_BASE,
    grid: { left: 10, right: 18, top: 18, bottom: 24, containLabel: true },
    tooltip: { ...CHART_BASE.tooltip, trigger: "axis", axisPointer: { type: "cross" } },
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
    dataZoom: [{ type: "inside" }, { type: "slider", height: 16, bottom: 2, borderColor: "transparent", backgroundColor: "rgba(255,255,255,0.04)", fillerColor: "rgba(91,141,239,0.2)", textStyle: { color: CHART_COLORS.muted } }],
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