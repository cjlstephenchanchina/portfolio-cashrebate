/* 港交所成交額 Top 30（2026-08-11 收市，按成交金額排行，僅上市公司）
 * 資料來源：港交所公開行情／綜合行情網站；金額單位：億港元。
 * color/mono 為 logo 缺圖時的徽章兜底。
 */
"use strict";

(function () {
  var TOP30 = [
    { code: "09988", cn: "阿里巴巴-W",  en: "Alibaba",     mv: "95.05億", color: "#FF6A00", mono: "阿" },
    { code: "00700", cn: "騰訊控股",    en: "Tencent",     mv: "92.50億", color: "#12B7F5", mono: "騰" },
    { code: "02513", cn: "智譜",        en: "Z.AI",        mv: "40.47億", color: "#3B82F6", mono: "智" },
    { code: "01888", cn: "建滔積層板",  en: "KB Laminates", mv: "38.01億", color: "#B51E2D", mono: "建" },
    { code: "00100", cn: "MINIMAX-W",   en: "MiniMax",     mv: "33.36億", color: "#6C5CE7", mono: "M" },
    { code: "01810", cn: "小米集團-W",  en: "Xiaomi",      mv: "32.41億", color: "#FF6900", mono: "米" },
    { code: "02899", cn: "紫金礦業",    en: "Zijin Mining", mv: "32.06億", color: "#E60012", mono: "紫" },
    { code: "03690", cn: "美團-W",      en: "Meituan",     mv: "31.51億", color: "#FFD100", mono: "美" },
    { code: "00992", cn: "聯想集團",    en: "Lenovo",      mv: "27.02億", color: "#E60012", mono: "聯" },
    { code: "01347", cn: "華虹宏力",    en: "Hua Hong",    mv: "25.86億", color: "#005BAC", mono: "華" },
    { code: "00981", cn: "中芯國際",    en: "SMIC",        mv: "25.17億", color: "#0E7BD8", mono: "芯" },
    { code: "01299", cn: "友邦保險",    en: "AIA",         mv: "23.56億", color: "#002FA7", mono: "友" },
    { code: "02269", cn: "藥明生物",    en: "WuXi Biologics", mv: "22.06億", color: "#00A651", mono: "藥" },
    { code: "02259", cn: "紫金黃金國際", en: "Zijin Gold Intl.", mv: "20.66億", color: "#C9A227", mono: "金" },
    { code: "03308", cn: "中際旭創",    en: "Innolight",   mv: "19.46億", color: "#E5002E", mono: "中" },
    { code: "01024", cn: "快手-W",      en: "Kuaishou",    mv: "19.21億", color: "#FF4906", mono: "快" },
    { code: "00883", cn: "中國海洋石油", en: "CNOOC",       mv: "19.18億", color: "#0066A1", mono: "海" },
    { code: "06869", cn: "長飛光纖光纜", en: "YOFC",        mv: "18.07億", color: "#E60012", mono: "長" },
    { code: "03986", cn: "兆易創新",    en: "GigaDevice",  mv: "18.01億", color: "#C8102E", mono: "兆" },
    { code: "02359", cn: "藥明康德",    en: "WuXi AppTec", mv: "17.93億", color: "#00A651", mono: "藥" },
    { code: "00388", cn: "香港交易所",  en: "HKEX",        mv: "17.92億", color: "#111111", mono: "港" },
    { code: "01548", cn: "金斯瑞生物科技", en: "GenScript",  mv: "17.58億", color: "#0069B4", mono: "金" },
    { code: "06160", cn: "百濟神州",    en: "BeiGene",     mv: "17.37億", color: "#B11116", mono: "百" },
    { code: "00005", cn: "匯豐控股",    en: "HSBC",        mv: "15.82億", color: "#DB0011", mono: "匯" },
    { code: "03750", cn: "寧德時代",    en: "CATL",        mv: "15.81億", color: "#1A6FB5", mono: "寧" },
    { code: "06809", cn: "瀾起科技",    en: "Montage",     mv: "13.93億", color: "#0B5CAD", mono: "瀾" },
    { code: "02318", cn: "中國平安",    en: "Ping An",     mv: "13.72億", color: "#E60012", mono: "平" },
    { code: "03330", cn: "靈寶黃金",    en: "Lingbao Gold", mv: "13.30億", color: "#B8860B", mono: "靈" },
    { code: "09992", cn: "泡泡瑪特",    en: "Pop Mart",    mv: "12.58億", color: "#E6007E", mono: "泡" },
    { code: "02628", cn: "中國人壽",    en: "China Life",  mv: "11.97億", color: "#E60012", mono: "壽" }
  ];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function render() {
    var box = document.getElementById("top30-grid");
    if (!box) return;
    box.innerHTML = TOP30.map(function (d, i) {
      var rank = i + 1;
      return '<div class="top30-item" title="' + esc(d.cn + " " + d.en + " · " + d.mv) + '">' +
        '<span class="top30-rank">' + rank + '</span>' +
        '<span class="top30-badge">' +
        '<img class="top30-logo" src="img/logos/' + esc(d.code) + '.png" alt="' + esc(d.en) + '" width="56" height="56" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
        '<span class="top30-mono" style="display:none;background:' + esc(d.color) + '">' + esc(d.mono) + '</span>' +
        '</span>' +
        '<span class="top30-name">' + esc(d.cn) + '<small>' + esc(d.en) + '</small></span>' +
        '<span class="top30-code">' + esc(d.code) + ' · ' + esc(d.mv) + '</span>' +
        '</div>';
    }).join("");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
