/* HERO 背景影片：正放 → 倒放 → 正放…無縫來回循環（ping-pong loop）
 *
 * 設計重點（避免干擾首次播放）：
 * 1. 初始階段完全不寫入影片（只讀 currentTime），保持與原本 autoplay/loop 完全相同的播放行為。
 * 2. 偵測到第一次「播完跳回開頭」的瞬間才接管：移除 loop、改為倒放。
 * 3. 優先使用瀏覽器原生負速率（Chrome/Safari/Edge 支援 playbackRate = -1）；
 *    若倒退卡住超過約 0.7 秒，自動切換為「逐幀倒退」模式（rAF 驅動 currentTime）。
 */
"use strict";

(function () {
  var v = document.querySelector(".hero-cinema__media video");
  if (!v) return;

  var SPEED = 1;
  var dir = 1;            // 1 = 正放, -1 = 倒放
  var flipped = false;    // 是否已接管（第一次播完後）
  var manual = false;     // 是否使用逐幀倒退
  var raf = 0;
  var last = 0;
  var lastT = -1;
  var stallCount = 0;
  var prepared = false;

  /* 影片已可播放：移除 loop，讓第一輪自然播完（不會有「跳回開頭」的瞬間） */
  function prepare() {
    if (prepared) return;
    prepared = true;
    try {
      v.removeAttribute("loop");
      v.loop = false;
    } catch (e) { /* ignore */ }
  }

  function supportsNegativeRate() {
    try {
      var prev = v.playbackRate;
      v.playbackRate = -1;
      var ok = v.playbackRate === -1;
      v.playbackRate = prev || 1;
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

  /* 接管：第一次播完時呼叫 */
  function takeover() {
    if (flipped) return;
    flipped = true;
    prepare();
    manual = !supportsNegativeRate();
    if (manual) {
      try { v.pause(); } catch (e) { /* ignore */ }
      last = 0;
      raf = requestAnimationFrame(step);
    } else {
      v.playbackRate = SPEED;
      raf = requestAnimationFrame(watchdog);
    }
  }

  /* 逐幀倒退模式：暫停原生播放，由 rAF 每幀推進 currentTime */
  function step(ts) {
    if (!last) last = ts;
    var dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    var dur = v.duration || 0;
    if (dur && isFinite(dur) && dur > 0) {
      var t = v.currentTime + dir * SPEED * dt;
      if (t >= dur) { t = dur; dir = -1; }
      else if (t <= 0) { t = 0; dir = 1; }
      try { v.currentTime = t; } catch (e) { /* ignore */ }
    }
    raf = requestAnimationFrame(step);
  }

  /* 原生負速率模式：邊界翻轉 + 卡住偵測（倒退逾時 → 改逐幀） */
  function watchdog(ts) {
    var dur = v.duration || 0;
    if (dur && isFinite(dur) && dur > 0) {
      if (dir > 0 && v.currentTime >= dur - 0.06) flip(-1);
      else if (dir < 0 && v.currentTime <= 0.06) flip(1);

      if (!v.paused) {
        if (Math.abs(v.currentTime - lastT) < 1e-4) {
          stallCount++;
          if (stallCount > 40) {          // 約 0.7 秒沒有前進 → 卡住，切逐幀
            enterManual();
            return;
          }
        } else {
          stallCount = 0;
          lastT = v.currentTime;
        }
      } else {
        var atBoundary = v.currentTime <= 0.06 || v.currentTime >= dur - 0.06;
        if (atBoundary) {
          flip(dir === -1 ? 1 : -1);
          playSafe();
        }
      }
    }
    raf = requestAnimationFrame(watchdog);
  }

  function enterManual() {
    if (manual) return;
    manual = true;
    try { v.pause(); } catch (e) { /* ignore */ }
    last = 0;
    raf = requestAnimationFrame(step);
  }

  /* 初始階段：只讀不寫，偵測第一次 loop 跳回開頭 */
  var preT = -1;
  function detectFirstLoop(ts) {
    if (!flipped) {
      var dur = v.duration || 0;
      if (dur && isFinite(dur) && dur > 0 && preT >= 0 && dir === 1) {
        if (v.currentTime < preT - 0.5) {
          takeover();
          flip(-1);
          playSafe();
          return;
        }
      }
      preT = v.currentTime;
      raf = requestAnimationFrame(detectFirstLoop);
    }
  }
  raf = requestAnimationFrame(detectFirstLoop);

  /* 保險：正放自然播完（非 loop）或暫停在端點時，翻轉並繼續 */
  v.addEventListener("ended", function () {
    if (!flipped) takeover();
    flip(-1);
    playSafe();
  });
  v.addEventListener("canplay", prepare);
  v.addEventListener("loadeddata", prepare);
  v.addEventListener("pause", function () {
    if (!flipped) return;
    var dur = v.duration || 0;
    if (!dur || !isFinite(dur) || dur <= 0) return;
    var atBoundary = v.currentTime <= 0.06 || v.currentTime >= dur - 0.06;
    if (atBoundary) {
      flip(dir === -1 ? 1 : -1);
      playSafe();
    }
  });
})();
