/* ================= 圖表渲染（ECharts）— 深色高端金融風 ================= */
"use strict";
const CHART_COLORS = {
  text: "#ECF0F8", muted: "#8A95AE", faint: "#525B72",
  ink: "#FFFFFF", gray: "#99948C",
  blue: "#4D6BFF", blueDark: "#6A85FF", blueDeep: "#1A2B99",
  pink: "#FFF1E5", pinkDeep: "#F2D3C2",
  red: "#FF5468", green: "#00E0A0",
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
    backgroundColor: "rgba(11,15,22,0.96)",
    borderColor: "rgba(77,107,255,0.35)",
    borderWidth: 1,
    textStyle: { color: CHART_COLORS.text, fontSize: 12.5 },
    extraCssText: "box-shadow: 0 18px 40px rgba(0,0,0,0.55); border-radius: 8px; backdrop-filter: blur(12px);",
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

/* Top 3 — 橫向條形（FT 藍） */
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
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
    },
    yAxis: {
      type: "category", data: labels,
      axisLabel: { color: CHART_COLORS.text, fontSize: 13, fontWeight: 600 },
      axisLine: { show: false }, axisTick: { show: false },
    },
    series: [{
      type: "bar", data: values, barWidth: 18,
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: "#1A2B99" }, { offset: 1, color: "#4D6BFF" },
        ]),
      },
      label: {
        show: true, position: "right", color: "#4D6BFF", fontWeight: 600,
        formatter: (p) => "HK$" + fmtMoney(p.value),
      },
    }],
  }, true);
}

/* 市場分佈 — donut（深色配色） */
function renderMarket(id, data) {
  const chart = initChart(id);
  if (!chart) return;
  const palette = [CHART_COLORS.blue, CHART_COLORS.ink, CHART_COLORS.gray,
                   CHART_COLORS.green, CHART_COLORS.red];
  chart.setOption({
    ...CHART_BASE,
    tooltip: {
      ...CHART_BASE.tooltip,
      formatter: (p) => `${p.name}<br/><b>HK$${fmtMoney(p.value)}</b>（${p.percent}%）`,
    },
    series: [{
      type: "pie", radius: ["52%", "76%"], center: ["50%", "52%"],
      avoidLabelOverlap: true, itemStyle: { borderRadius: 3, borderColor: "#06080F", borderWidth: 3 },
      label: { color: CHART_COLORS.text, fontSize: 12.5, formatter: "{b}\n{c}" },
      labelLine: { lineStyle: { color: CHART_COLORS.gray } },
      data: (data || []).map((d, i) => ({
        name: MARKET_LABEL[d.market] || d.market, value: d.value,
        itemStyle: { color: palette[i % palette.length] },
      })),
    }],
  }, true);
}

/* 各客戶回贈 — 柱狀（FT 綠） */
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
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } }, axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: CHART_COLORS.muted },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
    },
    series: [{
      type: "bar", data: rebates, barWidth: "42%",
      itemStyle: { borderRadius: [4, 4, 0, 0], color: "#00E0A0" },
      label: {
        show: true, position: "top", color: "#00E0A0", fontWeight: 600,
        formatter: (p) => "HK$" + fmtMoney(p.value),
      },
    }],
  }, true);
}