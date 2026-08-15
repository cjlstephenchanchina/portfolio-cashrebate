/* =====================================================================
 * datepicker.js — 自訂日期選擇器
 *  - 圓角矩形日期格、圓角彈窗、主題色（--accent）高亮
 *  - 取代原生 input[type=date]（原生彈窗無法用 CSS 樣式化）
 *  - 任何帶 .date-pick 的 input：點擊／聚焦開啟，選取後寫入 YYYY-MM-DD
 * ===================================================================== */
(function () {
  "use strict";

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmt(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parse(s) {
    if (!s) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function langTag() { return (window.I18N && I18N.lang) || "zh-Hant"; }
  function monthNames(tag) {
    var f = new Intl.DateTimeFormat(tag, { month: "long" });
    var out = [];
    for (var i = 0; i < 12; i++) out.push(f.format(new Date(2000, i, 1)));
    return out;
  }
  function weekdayNames(tag) {
    var f = new Intl.DateTimeFormat(tag, { weekday: "short" });
    var out = [];
    for (var i = 0; i < 7; i++) out.push(f.format(new Date(2020, 0, 5 + i))); // 2020-01-05 為週日
    return out;
  }

  var pop = null;
  var popOpenAt = 0;
  var popHandledEvent = null;

  function closePop() {
    if (pop) { pop.remove(); pop = null; }
    document.removeEventListener("click", onDocClick);
    document.removeEventListener("keydown", onDocKey);
    window.removeEventListener("scroll", onScrollGrace, true);
    window.removeEventListener("resize", onResizeGrace);
  }
  function onDocClick(e) {
    /* 彈窗內已處理的事件（如切月、今天/清除）重繪後原按鈕已脫離 DOM，
       直接略過，避免誤關彈窗 */
    if (e === popHandledEvent) { popHandledEvent = null; return; }
    if (pop && !pop.contains(e.target) && !(e.target.classList && e.target.classList.contains("date-pick"))) closePop();
  }
  function onDocKey(e) { if (e.key === "Escape") closePop(); }

  function onScrollGrace() {
    /* 頁面載入時的 scroll-to-top 會誤關彈窗；開啟後 500ms 內忽略滾動 */
    if (Date.now() - popOpenAt < 500) return;
    closePop();
  }
  function onResizeGrace() {
    if (Date.now() - popOpenAt < 500) return;
    closePop();
  }

  function buildPopup(input) {
    closePop();
    if (input.disabled) return;
    popOpenAt = Date.now();

    var sel = parse(input.value);
    var view = sel ? new Date(sel.getFullYear(), sel.getMonth(), 1) : new Date();
    var tag = langTag();
    var months = monthNames(tag);
    var weeks = weekdayNames(tag);
    var todayLabel = (window.I18N && I18N.t("date.today")) || "今天";
    var clearLabel = (window.I18N && I18N.t("date.clear")) || "清除";

    pop = document.createElement("div");
    pop.className = "date-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Date picker");
    document.body.appendChild(pop);

    function render() {
      var y = view.getFullYear(), m = view.getMonth();
      var title = tag === "en" ? months[m] + " " + y : y + " 年 " + months[m];
      var startDow = new Date(y, m, 1).getDay();
      var daysInMonth = new Date(y, m + 1, 0).getDate();
      var now = new Date();
      var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var html =
        '<div class="dp-head">' +
          '<button type="button" class="dp-nav" data-nav="-1" aria-label="Prev">‹</button>' +
          '<span class="dp-title"></span>' +
          '<button type="button" class="dp-nav" data-nav="1" aria-label="Next">›</button>' +
        '</div>' +
        '<div class="dp-week">' + weeks.map(function (w) { return "<span>" + w + "</span>"; }).join("") + "</div>" +
        '<div class="dp-grid">';
      for (var i = 0; i < startDow; i++) html += '<span class="dp-cell blank"></span>';
      for (var d = 1; d <= daysInMonth; d++) {
        var date = new Date(y, m, d);
        var cls = "dp-cell";
        if (sel && fmt(date) === fmt(sel)) cls += " selected";
        if (fmt(date) === fmt(today)) cls += " today";
        html += '<button type="button" class="' + cls + '" data-d="' + d + '">' + d + "</button>";
      }
      html += "</div>";
      html +=
        '<div class="dp-foot">' +
          '<button type="button" class="dp-action" data-act="today">' + todayLabel + "</button>" +
          '<button type="button" class="dp-action" data-act="clear">' + clearLabel + "</button>" +
        "</div>";
      pop.innerHTML = html;
      pop.querySelector(".dp-title").textContent = title;
    }
    render();

    pop.addEventListener("click", function (e) {
      popHandledEvent = e;
      var nav = e.target.closest("[data-nav]");
      if (nav) {
        view = new Date(view.getFullYear(), view.getMonth() + (+nav.getAttribute("data-nav")), 1);
        render();
        return;
      }
      var act = e.target.closest("[data-act]");
      if (act) {
        var a = act.getAttribute("data-act");
        if (a === "today") input.value = fmt(new Date());
        else if (a === "clear") input.value = "";
        input.dispatchEvent(new Event("change", { bubbles: true }));
        closePop();
        return;
      }
      var cell = e.target.closest(".dp-cell:not(.blank)");
      if (!cell) return;
      var picked = new Date(view.getFullYear(), view.getMonth(), +cell.getAttribute("data-d"));
      input.value = fmt(picked);
      input.dispatchEvent(new Event("change", { bubbles: true }));
      closePop();
    });

    var r = input.getBoundingClientRect();
    var popW = 288;
    var left = Math.min(r.left, window.innerWidth - popW - 8);
    if (left < 8) left = 8;
    pop.style.left = left + "px";
    pop.style.top = (r.bottom + 6) + "px";

    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onDocKey);
    window.addEventListener("scroll", onScrollGrace, true);
    window.addEventListener("resize", onResizeGrace);
  }

  function init() {
    document.querySelectorAll("input.date-pick").forEach(function (input) {
      input.addEventListener("click", function () { buildPopup(input); });
      input.addEventListener("focus", function () { buildPopup(input); });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
