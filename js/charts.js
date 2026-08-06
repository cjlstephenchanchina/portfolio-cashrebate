/* ================= 圖表渲染（ECharts）— 淺色克制風 ================= */
"use strict";
const CHART_COLORS = {
  text: "#161616", muted: "#6E6C66", faint: "#A5A29B",
  black: "#1B1B1B", gray: "#8C8A84",
  red: "#C2453E", green: "#2F7D5B",
  gold: "#A67C00", blue: "#3B5B8C", purple: "#6A5A8C",
};

const MARKET_LABEL = { HK: "港股", A: "A股", US: "美股" };

const fmtMoney = (v) => {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return Number(v).toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtInt = (v) => Number(v || 0).toLocaleString("zh-HK");

const CHART_BASE = {
  backgroundColor: "transparent",
  textStyle: { color: CHART_COLORS.text, fontFamily: "Inter, system-ui, sans-serif", fontSize: 12 },
  grid: { left: 10, right: 28, top: 22, bottom: 6, containLabel: true },
  tooltip: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E7E5E0",
    borderWidth: 1,
    textStyle: { color: CHART_COLORS.text, fontSize: 12.5 },
    extraCssText: "box-shadow: 0 12px 32px rgba(20,20,20,0.12); border-radius: 8px;",
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

/* Top 3 持倉股票 — 橫向條形 */
function renderTop3(id, data) {
  const chart = initChart(id);
  if (!chart) return;
  const labels = (data || []).map((d) => `${d.code} · ${MARKET_LABEL[d.market] || d.market}`);
  const values = (data || []).map((d) => d.value);
  chart.setOption({
    ...CHART_BASE,
    xAxis: {
      type: "value",
      axisLabel: { color: CHART_COLORS.muted, formatter: (v) => (v >= 1e6 ? (v / 1e6) + "M" : v >= 1e4 ? (v / 1e4) + "萬" : v) },
      splitLine: { lineStyle: { color: "#F0EEE9" } },
    },
    yAxis: {
      type: "category", data: labels,
      axisLabel: { color: CHART_COLORS.text, fontSize: 13, fontWeight: 500 },
      axisLine: { show: false }, axisTick: { show: false },
    },
    series: [{
      type: "bar", data: values, barWidth: 18,
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: "#1B1B1B",
      },
      label: {
        show: true, position: "right", color: CHART_COLORS.text, fontWeight: 500,
        formatter: (p) => "HK$" + fmtMoney(p.value),
      },
    }],
  }, true);
}

/* 市場分佈 — donut */
function renderMarket(id, data) {
  const chart = initChart(id);
  if (!chart) return;
  const palette = [CHART_COLORS.black, CHART_COLORS.gray, CHART_COLORS.red,
                   CHART_COLORS.green, CHART_COLORS.blue];
  chart.setOption({
    ...CHART_BASE,
    tooltip: {
      ...CHART_BASE.tooltip,
      formatter: (p) => `${p.name}<br/><b>HK$${fmtMoney(p.value)}</b>（${p.percent}%）`,
    },
    series: [{
      type: "pie", radius: ["52%", "76%"], center: ["50%", "52%"],
      avoidLabelOverlap: true, itemStyle: { borderRadius: 4, borderColor: "#FFFFFF", borderWidth: 3 },
      label: { color: CHART_COLORS.text, fontSize: 12.5, formatter: "{b}\n{c}" },
      labelLine: { lineStyle: { color: CHART_COLORS.gray } },
      data: (data || []).map((d, i) => ({
        name: MARKET_LABEL[d.market] || d.market, value: d.value,
        itemStyle: { color: palette[i % palette.length] },
      })),
    }],
  }, true);
}

/* 各客戶回贈 — 柱狀 */
function renderRebate(id, data) {
  const chart = initChart(id);
  if (!chart) return;
  const clients = (data || []).map((d) => d.client);
  const rebates = (data || []).map((d) => d.rebate);
  chart.setOption({
    ...CHART_BASE,
    xAxis: {
      type: "category", data: clients,
      axisLabel: { color: CHART_COLORS.muted, fontSize: 12 },
      axisLine: { lineStyle: { color: "#E7E5E0" } }, axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: CHART_COLORS.muted },
      splitLine: { lineStyle: { color: "#F0EEE9" } },
    },
    series: [{
      type: "bar", data: rebates, barWidth: "42%",
      itemStyle: { borderRadius: [6, 6, 0, 0], color: "#2F7D5B" },
      label: {
        show: true, position: "top", color: CHART_COLORS.green, fontWeight: 500,
        formatter: (p) => "HK$" + fmtMoney(p.value),
      },
    }],
  }, true);
}
