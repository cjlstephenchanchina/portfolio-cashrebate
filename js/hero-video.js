/* HERO 背景影片：正放 → 倒放 → 正放…無縫來回循環（ping-pong loop）
 * - 優先使用瀏覽器原生倒放（playbackRate = -1，Chrome/Safari/Edge 支援）
 * - 不支援負速率的瀏覽器自動切換為「逐幀倒退」模式（requestAnimationFrame 驅動 currentTime）
 * - 保留 HTML 上的 loop 屬性作最後兜底：JS 一旦成功接管就移除 loop，避免「播完跳回開頭」
 */
"use strict";

(function () {
  var v = document.querySelector(".hero-cinema__media video");
  if (!v) return;

  var SPEED = 1;          // 播放速率（1 = 正常）
  var dir = 1;            // 1 = 正放, -1 = 倒放
  var manual = false;     // 是否使用逐幀倒退（原生負速率不可用時）
  var started = false;
  var raf = 0;
  var last = 0;

  function supportsNegativeRate() {
    try {
      var prev = v.playbackRate;
      v.playbackRate = -1;
      var ok = v.playbackRate === -1;
      v.playbackRate = prev;
      return ok;
    } catch (e) {
      return false;
    }
  }

  function flip(d) {
    if (dir === d) return;
    dir = d;
    if (!manual) {
      try { v.playbackRate = d * SPEED; } catch (e) { /* ignore */ }
    }
  }

  function playSafe() {
    var p = v.play();
    if (p && p.catch) p.catch(function () { /* 忽略自動播放被拒 */ });
  }

  function step(ts) {
    if (!last) last = ts;
    var dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    var dur = v.duration || 0;

    if (dur && isFinite(dur) && dur > 0) {
      // 邊界偵測：到結尾倒放、到開頭正放
      if (dir > 0 && v.currentTime >= dur - 0.06) flip(-1);
      else if (dir < 0 && v.currentTime <= 0.06) flip(1);

      if (manual) {
        var t = v.currentTime + dir * SPEED * dt;
        if (t >= dur) { t = dur; dir = -1; }
        else if (t <= 0) { t = 0; dir = 1; }
        try { v.currentTime = t; } catch (e) { /* ignore */ }
      }

      // 兜底：倒放到開頭或正放到結尾後瀏覽器可能自行暫停，偵測後繼續播放
      if (v.paused && v.readyState >= 2 && document.visibilityState === "visible") {
        var atBoundary = v.currentTime <= 0.06 || v.currentTime >= dur - 0.06;
        if (atBoundary) playSafe();
      }
    }
    raf = requestAnimationFrame(step);
  }

  function start() {
    if (started) return;
    started = true;
    try {
      manual = !supportsNegativeRate();
      v.removeAttribute("loop");       // 接管循環，避免「播完跳回開頭」
      v.loop = false;
      v.playbackRate = SPEED;
      raf = requestAnimationFrame(step); // 邊界偵測／暫停偵測（兩種模式都需要）
      playSafe();
    } catch (e) {
      // 接管失敗：回復瀏覽器原生 loop，確保至少會自動循環
      try { v.loop = true; } catch (e2) { /* ignore */ }
    }
  }

  v.addEventListener("ended", function () {
    // 正放到結尾（理論上 rAF 已先攔截；此為保險）
    if (dir > 0) flip(-1);
    playSafe();
  });
  start();
})();
