/* =====================================================================
 * i18n 引擎 — Nora-AI Capital 多語系支援
 *  - I18N.t(key, vars)        : 取字串並插值 {var}
 *  - I18N.applyStatic()       : 套用 [data-i18n] / -ph / -title / -aria
 *  - I18N.applyDoc()          : 套用 <title> / meta / <html lang>
 *  - I18N.registerDynamic(fn) : 註冊語言切換時需重渲染的回呼（動態內容）
 *  - I18N.setLang(lang)       : 切換語言並寫入 localStorage
 *  - MARKET_LABEL(m)          : 語言感知的市場標籤（取代原 charts.js 常數）
 * 依賴：js/locales/*.js 必須在本檔之前載入（於 index.html 中已排序）。
 * ===================================================================== */
"use strict";

var I18N = {
  lang: "zh-Hant",
  dynamic: [],

  /* 語言回退鏈：當前語言 → 預設繁體 → key 本身（開發期可見缺漏） */
  t: function (key, vars) {
    var dict = (I18N_DATA && I18N_DATA[this.lang]) || {};
    var s = dict[key];
    if (s === undefined) {
      var fallback = (I18N_DATA && I18N_DATA["zh-Hant"]) || {};
      s = fallback[key];
    }
    if (s === undefined) return key;
    if (vars && typeof s === "string") {
      s = s.replace(/\{(\w+)\}/g, function (_m, k) {
        return vars[k] !== undefined ? vars[k] : "{" + k + "}";
      });
    }
    return s;
  },

  applyStatic: function () {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = I18N.t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      el.setAttribute("placeholder", I18N.t(el.getAttribute("data-i18n-ph")));
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      el.setAttribute("title", I18N.t(el.getAttribute("data-i18n-title")));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      el.setAttribute("aria-label", I18N.t(el.getAttribute("data-i18n-aria")));
    });
    // 允許含 HTML 的靜態字串（如頁尾帶 <br> 的說明），由受信任的語言檔提供
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      el.innerHTML = I18N.t(el.getAttribute("data-i18n-html"));
    });
  },

  applyDoc: function () {
    var root = document.documentElement;
    if (root) root.lang = this.lang;
    var t = this.t("meta.title");
    if (t && t !== "meta.title") document.title = t;
    var m;
    m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute("content", this.t("meta.description"));
    m = document.querySelector('meta[property="og:title"]');
    if (m) m.setAttribute("content", this.t("meta.ogTitle"));
    m = document.querySelector('meta[property="og:description"]');
    if (m) m.setAttribute("content", this.t("meta.ogDescription"));
  },

  registerDynamic: function (fn) {
    if (typeof fn === "function") this.dynamic.push(fn);
  },

  setLang: function (lang) {
    if (!I18N_DATA || !I18N_DATA[lang]) lang = "zh-Hant";
    this.lang = lang;
    try { localStorage.setItem("site_lang", lang); } catch (e) { /* ignore */ }
    this.applyStatic();
    this.applyDoc();
    // 重渲染所有動態內容（結果表格、圖表、KPI、持倉表等）
    this.dynamic.forEach(function (fn) {
      try { fn(); } catch (e) { console.warn("i18n dynamic render failed:", e); }
    });
    if (typeof this.updateSwitcher === "function") this.updateSwitcher();
  },
};

/* 語言感知的市場標籤（HK / A / US）。原 charts.js 的 const MARKET_LABEL 物件已移除，改由本函式取代。 */
function MARKET_LABEL(m) {
  return (window.I18N && I18N.t("mk." + String(m).toLowerCase())) || m;
}

/* ---------- 初始化：判斷語言（localStorage > 預設英文） ---------- */
(function initLang() {
  var lang = "en";
  try {
    var stored = localStorage.getItem("site_lang");
    if (stored && I18N_DATA && I18N_DATA[stored]) {
      lang = stored;
    }
  } catch (e) { /* ignore */ }
  I18N.lang = lang;

  // 腳本位於 body 末端，DOM 已就緒，立即套用靜態文字與文件標題
  I18N.applyStatic();
  I18N.applyDoc();

  // DOMContentLoaded 再做一次（確保後載入的動態節點亦正確）
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      I18N.applyStatic();
      I18N.applyDoc();
    });
  }
})();

/* ---------- 語言切換按鈕（位於 header 右上，nav-live 與 hamburger 之間） ---------- */
(function initSwitcher() {
  var SHORT = { "zh-Hant": "繁", "zh-Hans": "简", "en": "EN" };

  function buildMenu() {
    var box = document.getElementById("langSwitch");
    if (!box) return;
    box.innerHTML =
      '<button class="lang-btn" id="langBtn" type="button" aria-haspopup="true" aria-expanded="false">' +
        '<span class="lang-current">' + (SHORT[I18N.lang] || "繁") + '</span>' +
        '<span class="caret" aria-hidden="true">▾</span>' +
      '</button>' +
      '<ul class="lang-menu" id="langMenu" role="menu" hidden>' +
        '<li role="menuitem" data-lang="zh-Hant"' + (I18N.lang === "zh-Hant" ? ' class="active"' : '') + '>繁體中文</li>' +
        '<li role="menuitem" data-lang="zh-Hans"' + (I18N.lang === "zh-Hans" ? ' class="active"' : '') + '>简体中文</li>' +
        '<li role="menuitem" data-lang="en"' + (I18N.lang === "en" ? ' class="active"' : '') + '>English</li>' +
      '</ul>';

    var btn = document.getElementById("langBtn");
    var menu = document.getElementById("langMenu");

    function open() { menu.hidden = false; btn.setAttribute("aria-expanded", "true"); }
    function close() { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (menu.hidden) open(); else close();
    });
    menu.addEventListener("click", function (e) {
      var li = e.target.closest("li[data-lang]");
      if (!li) return;
      var lang = li.getAttribute("data-lang");
      close();
      if (lang !== I18N.lang) I18N.setLang(lang);
    });
    document.addEventListener("click", function (e) {
      if (!box.contains(e.target)) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  I18N.updateSwitcher = function () {
    var cur = document.querySelector("#langSwitch .lang-current");
    if (cur) cur.textContent = SHORT[I18N.lang] || "繁";
    var menu = document.getElementById("langMenu");
    if (menu) {
      menu.querySelectorAll("li[data-lang]").forEach(function (li) {
        li.classList.toggle("active", li.getAttribute("data-lang") === I18N.lang);
      });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildMenu);
  } else {
    buildMenu();
  }
})();
