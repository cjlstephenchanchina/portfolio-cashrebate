/* =====================================================================
 * theme.js — 白天／深夜／自動 三態主題引擎（Nora-AI Capital）
 *  - 首選值：localStorage("site_theme") ∈ {day, night, auto}，缺省 auto
 *  - auto：依瀏覽器本地時間 06:00–17:59＝白天、18:00–05:59＝深夜
 *  - 設定 document.documentElement[data-theme]（head 內聯腳本已先設好，避免 FOUC）
 *  - 同步 meta theme-color、極光 AuroraBG、ECharts 圖表調色盤
 *  - 自動模式每 30 秒檢查時段邊界，跨 06:00／18:00 自動切換
 * 依賴：i18n.js（可選）、aurora-bg.js（可選）、charts.js（可選）
 * ===================================================================== */
(function () {
  "use strict";

  var KEY = "site_theme";
  var DAY_START = 6;   // 06:00
  var DAY_END = 18;    // 18:00（含 17:59）

  function getMode() {
    try {
      var v = localStorage.getItem(KEY);
      if (v === "day" || v === "night" || v === "auto") return v;
    } catch (e) { /* ignore */ }
    return "auto";
  }

  function effective(mode) {
    var m = mode || getMode();
    if (m !== "auto") return m;
    var h = new Date().getHours();
    return (h >= DAY_START && h < DAY_END) ? "day" : "night";
  }

  var ICONS = { day: "☀", night: "🌙", auto: "⏱" };
  var linesBuilt = false;
  var sceneBuilt = false;

  /* 白天 hero 曲線：桌面左右各 20、手機左右各 12；近全高（top 0、高度 92–98%） */
  function buildDayLines() {
    if (linesBuilt) return;
    linesBuilt = true;
    var box = document.getElementById("heroDayLines");
    if (!box) return;
    var mobile = window.innerWidth < 810;
    var N = mobile ? 12 : 20;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < N; i++) {
      var h = 92 + ((i * 5) % 7);
      var el = document.createElement("i");
      el.className = "hc-line hc-line--l";
      el.style.setProperty("--i", i);
      el.style.setProperty("--t", "0%");
      el.style.setProperty("--h", h + "%");
      frag.appendChild(el);
      var er = document.createElement("i");
      er.className = "hc-line hc-line--r";
      er.style.setProperty("--i", i);
      er.style.setProperty("--t", "0%");
      er.style.setProperty("--h", h + "%");
      frag.appendChild(er);
    }
    box.appendChild(frag);
  }

  /* 白天章節背景：綠色漸變物體＋變換線條（隨機大小／樣式／位置，漸隱漸出） */
  function buildDayScene() {
    var sc = document.getElementById("dayScene");
    if (!sc || sceneBuilt) return;
    sceneBuilt = true;
    var frag = document.createDocumentFragment();
    var base = document.createElement("div");
    base.className = "ds-base";
    frag.appendChild(base);

    var i;
    var greens = ["94,210,156", "47,191,142", "160,230,190"];
    var blues = ["110,190,235", "135,205,245", "170,215,245"];
    for (i = 0; i < 12; i++) {
      var b = document.createElement("i");
      b.className = "ds-blob";
      var size = 180 + Math.random() * 520;
      var g = greens[Math.floor(Math.random() * greens.length)];
      var bl = blues[Math.floor(Math.random() * blues.length)];
      var aG = (0.24 + Math.random() * 0.20).toFixed(2);  // 綠：0.24–0.44
      var aB = (aG * 0.65).toFixed(2);                    // 淡藍：只有綠的 65%，轉換輕柔
      var dx = ((Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 16)).toFixed(1) + "vw";
      var dy = ((Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 16)).toFixed(1) + "vh";
      b.style.cssText =
        "left:" + (Math.random() * 96).toFixed(1) + "%;" +
        "top:" + (Math.random() * 96).toFixed(1) + "%;" +
        "width:" + Math.round(size) + "px;" +
        "height:" + Math.round(size * (0.7 + Math.random() * 0.7)) + "px;" +
        "--dx:" + dx + ";--dy:" + dy + ";" +
        "--fadeDur:" + (9 + Math.random() * 9).toFixed(1) + "s;" +
        "--fadeDelay:" + (-Math.random() * 14).toFixed(1) + "s;" +
        "--driftDur:" + (40 + Math.random() * 40).toFixed(1) + "s;" +
        "--colorDur:" + (30 + Math.random() * 20).toFixed(1) + "s;" +   // 30–50 秒，慢
        "--colorDelay:" + (-Math.random() * 40).toFixed(1) + "s;" +
        "background-image:" +
          "radial-gradient(circle, rgba(" + g + "," + aG + "), rgba(" + g + ",0) 70%)," +
          "radial-gradient(circle, rgba(" + bl + "," + aB + "), rgba(" + bl + ",0) 70%);";
      frag.appendChild(b);
    }
    sc.appendChild(frag);
  }

  function apply(mode) {
    var m = mode || getMode();
    var eff = effective(m);
    var root = document.documentElement;
    root.setAttribute("data-theme", eff);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", eff === "day" ? "#F3F6FB" : "#070B0A");

    if (window.AuroraBG && AuroraBG.setTheme) AuroraBG.setTheme(eff);
    if (window.applyChartTheme) applyChartTheme();
    if (eff === "day") {
      buildDayLines();
      buildDayScene();
      var v = document.querySelector(".hero-cinema__media video");
      if (v && !v.paused) { try { v.pause(); } catch (e) { /* ignore */ } }
    } else if (window.HeroHLS && HeroHLS.start) {
      HeroHLS.start();
    }
    updateUI(m, eff);
  }

  function updateUI(mode, eff) {
    var btn = document.getElementById("themeBtn");
    if (btn) {
      btn.setAttribute("aria-label", window.I18N ? I18N.t("theme.aria") : "切換主題");
      var cur = document.getElementById("themeCurrent");
      if (cur) cur.textContent = ICONS[eff] || ICONS.night;
    }
    var menu = document.getElementById("themeMenu");
    if (menu) {
      menu.querySelectorAll("li[data-theme-opt]").forEach(function (li) {
        li.classList.toggle("active", li.getAttribute("data-theme-opt") === mode);
      });
    }
  }

  function refreshLabels(box) {
    if (!box || !window.I18N) return;
    box.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = I18N.t(el.getAttribute("data-i18n"));
    });
  }

  function buildUI() {
    var box = document.getElementById("themeSwitch");
    if (!box || box.dataset.built) return;
    box.dataset.built = "1";
    var mode = getMode();
    box.innerHTML =
      '<button class="lang-btn theme-btn" id="themeBtn" type="button" aria-haspopup="true" aria-expanded="false">' +
        '<span class="theme-current" id="themeCurrent">' + (ICONS[effective(mode)] || "🌙") + '</span>' +
        '<span class="caret" aria-hidden="true">▾</span>' +
      '</button>' +
      '<ul class="lang-menu theme-menu" id="themeMenu" role="menu" hidden>' +
        '<li role="menuitem" data-theme-opt="day"' + (mode === "day" ? ' class="active"' : '') + ' data-i18n="theme.option.day">白天</li>' +
        '<li role="menuitem" data-theme-opt="night"' + (mode === "night" ? ' class="active"' : '') + ' data-i18n="theme.option.night">深夜</li>' +
        '<li role="menuitem" data-theme-opt="auto"' + (mode === "auto" ? ' class="active"' : '') + ' data-i18n="theme.option.auto">自動</li>' +
      '</ul>';
    refreshLabels(box);

    var btn = document.getElementById("themeBtn");
    var menu = document.getElementById("themeMenu");
    function open() {
      /* 互相排除：開啟主題選單時關閉語言選單（避免兩個下拉重疊） */
      var lm = document.getElementById("langMenu");
      if (lm) {
        lm.hidden = true;
        var lb = document.getElementById("langBtn");
        if (lb) lb.setAttribute("aria-expanded", "false");
      }
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
    }
    function close() { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (menu.hidden) open(); else close();
    });
    menu.addEventListener("click", function (e) {
      var li = e.target.closest("li[data-theme-opt]");
      if (!li) return;
      var m = li.getAttribute("data-theme-opt");
      close();
      if (m !== getMode()) {
        try { localStorage.setItem(KEY, m); } catch (err) { /* ignore */ }
        apply(m);
      }
    });
    document.addEventListener("click", function (e) {
      if (!box.contains(e.target)) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    if (window.I18N && I18N.registerDynamic) {
      I18N.registerDynamic(function () {
        refreshLabels(box);
        updateUI(getMode(), effective());
        wireMenuHover();
      });
    }
  }

  /* ── 下拉選單「色塊跟隨鼠標」：一個移動高亮塊跟著 hover 的項目跑 ── */
  function wireMenuHover() {
    document.querySelectorAll(".lang-menu").forEach(function (menu) {
      if (menu.dataset.hover) return;
      menu.dataset.hover = "1";
      var hover = document.createElement("span");
      hover.className = "menu-hover";
      hover.setAttribute("aria-hidden", "true");
      menu.appendChild(hover);
      menu.querySelectorAll("li[data-theme-opt], li[data-lang]").forEach(function (li) {
        li.addEventListener("mouseenter", function () {
          hover.style.opacity = "1";
          hover.style.top = li.offsetTop + "px";
          hover.style.height = li.offsetHeight + "px";
        });
      });
      menu.addEventListener("mouseleave", function () {
        hover.style.opacity = "0";
      });
    });
  }

  function init() {
    buildUI();
    wireMenuHover();
    apply(getMode());
    /* auto 模式下每 30 秒檢查時段邊界（僅在跨 06:00／18:00 時有實際變化） */
    setInterval(function () {
      if (getMode() === "auto") apply("auto");
    }, 30000);
  }

  window.Theme = {
    mode: getMode,
    effective: effective,
    setMode: function (m) {
      if (m !== "day" && m !== "night" && m !== "auto") return;
      try { localStorage.setItem(KEY, m); } catch (e) { /* ignore */ }
      apply(m);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
