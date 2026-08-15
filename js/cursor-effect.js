/* =====================================================================
 * cursor-effect.js — slogan 主題色聚光（Nora-AI Capital）
 * 滑鼠移到 [data-cursor="blend"] 元素（hero slogan）上時：
 *  - rAF + lerp 平滑追蹤滑鼠（距離 < 50px 跟得較緊，遠離時較鬆）；
 *  - 每幀把追蹤到的位置寫成 --cx / --cy（相對於該元素的比例），
 *    hero.css 的 radial-gradient 聚光會以鼠標為中心把文字漸變成主題綠；
 *  - 滑鼠離開 slogan 或視窗時，把聚光中心移到元素外，文字回到原色。
 * 依賴：hero.css 的 .hc-slogan 聚光樣式。
 * ===================================================================== */
(function () {
  "use strict";

  var blendEl = null;   /* 目前滑鼠所在的 slogan 元素 */
  var tx = 0, ty = 0;   /* 滑鼠目標位置 */
  var x = 0, y = 0;     /* 聚光目前位置 */
  var started = false;
  var raf = 0;

  var reduced = false;
  try {
    reduced = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) { /* ignore */ }

  function updateSpotlight() {
    if (!blendEl) return;
    var r = blendEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var px = ((x - r.left) / r.width) * 100;
    var py = ((y - r.top) / r.height) * 100;
    blendEl.style.setProperty("--cx", px.toFixed(2) + "%");
    blendEl.style.setProperty("--cy", py.toFixed(2) + "%");
  }

  function clearSpotlight() {
    if (blendEl) {
      blendEl.style.setProperty("--cx", "-200%");
      blendEl.style.setProperty("--cy", "-200%");
      blendEl = null;
    }
  }

  function onMove(e) {
    tx = e.clientX;
    ty = e.clientY;
    if (!started) {          /* 首次出現直接貼到滑鼠，避免從 (0,0) 飛過來 */
      x = tx;
      y = ty;
      started = true;
    }
    if (reduced) {
      x = tx;
      y = ty;
      updateSpotlight();
    }
  }

  function onOver(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var el = t.closest('[data-cursor="blend"]');
    if (el !== blendEl) {
      if (blendEl) clearSpotlight();
      blendEl = el;
      if (blendEl) updateSpotlight();
    }
  }

  function onLeave() {
    clearSpotlight();
  }

  function tick() {
    var dx = tx - x;
    var dy = ty - y;
    var d = Math.sqrt(dx * dx + dy * dy);
    var k = d < 50 ? 0.7 : 0.4;   /* 近則快、遠則慢，與 DeepSeek 相同 */
    x += dx * k;
    y += dy * k;
    updateSpotlight();
    raf = requestAnimationFrame(tick);
  }

  function init() {
    raf = requestAnimationFrame(tick);
    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
