/* =====================================================================
 * About 頁：光束動效背景（移植自 React BeamsBackground）
 *  - Canvas 畫上升的光束（青→藍色相 190–260），JS blur(35px) + CSS blur(15px)
 *  - prefers-reduced-motion：停用動畫，保留深色底
 *  - 滾動逐段顯現：進入視口後才淡入該段文字（一次一段）
 * ===================================================================== */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Beams 背景 ---------- */
  var canvas = document.getElementById("about-beams");
  if (canvas && !reduced) {
    var ctx = canvas.getContext("2d");
    var MIN = 20;
    var beams = [];
    var rafId = 0;

    function createBeam(w, h) {
      return {
        x: Math.random() * w * 1.5 - w * 0.25,
        y: Math.random() * h * 1.5 - h * 0.25,
        width: 36 + Math.random() * 48,
        length: h * 2.5,
        angle: -35 + Math.random() * 10,
        speed: 0.6 + Math.random() * 1.2,
        opacity: 0.20 + Math.random() * 0.18,
        hue: 190 + Math.random() * 70,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
      };
    }

    function resize() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      /* 低解析度小畫布（1/3）+ CSS 放大：大幅降低每幀繪製與 blur 成本 */
      canvas.width = Math.max(1, Math.floor(w / 3));
      canvas.height = Math.max(1, Math.floor(h / 3));
      beams = [];
      for (var i = 0; i < MIN; i++) beams.push(createBeam(canvas.width, canvas.height));
    }

    function resetBeam(b, i, total) {
      var w = canvas.width;
      var col = i % 3;
      var spacing = w / 3;
      b.y = canvas.height + 100;
      b.x = col * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.5;
      b.width = 100 + Math.random() * 100;
      b.speed = 0.5 + Math.random() * 0.4;
      b.hue = 190 + (i * 70) / total;
      b.opacity = 0.30 + Math.random() * 0.12;
    }

    function drawBeam(b) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate((b.angle * Math.PI) / 180);
      var op = b.opacity * (0.8 + Math.sin(b.pulse) * 0.2);
      var g = ctx.createLinearGradient(0, 0, 0, b.length);
      g.addColorStop(0, "hsla(" + b.hue + ", 85%, 65%, 0)");
      g.addColorStop(0.1, "hsla(" + b.hue + ", 85%, 65%, " + (op * 0.5) + ")");
      g.addColorStop(0.4, "hsla(" + b.hue + ", 85%, 65%, " + op + ")");
      g.addColorStop(0.6, "hsla(" + b.hue + ", 85%, 65%, " + op + ")");
      g.addColorStop(0.9, "hsla(" + b.hue + ", 85%, 65%, " + (op * 0.5) + ")");
      g.addColorStop(1, "hsla(" + b.hue + ", 85%, 65%, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(-b.width / 2, 0, b.width, b.length);
      ctx.restore();
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      beams.forEach(function (b, i) {
        b.y -= b.speed;
        b.pulse += b.pulseSpeed;
        if (b.y + b.length < -100) resetBeam(b, i, beams.length);
        drawBeam(b);
      });
      rafId = requestAnimationFrame(animate);
    }

    window.addEventListener("resize", resize);
    resize();
    animate();
  }

  /* ---------- 滾動逐字浮現（捲動時文字一顆一顆亮起） ---------- */
  var blocks = Array.prototype.slice.call(document.querySelectorAll(".about-block"));
  var lastActive = {};

  /* 把段落文字切成單字 <span class="aw">，保留空白以維持排版 */
  function prepareWords() {
    blocks.forEach(function (b) {
      var p = b.querySelector("p");
      if (!p || p.getAttribute("data-prepared")) return;
      var txt = p.textContent;
      p.setAttribute("data-prepared", "1");
      p.innerHTML = "";
      var re = /(\S+\s*)/g, m;
      while ((m = re.exec(txt)) !== null) {
        var s = document.createElement("span");
        s.className = "aw";
        s.textContent = m[1];
        p.appendChild(s);
      }
    });
  }

  function setWords(b, active) {
    var p = b.querySelector("p");
    if (!p) return;
    var ws = p.querySelectorAll(".aw");
    for (var i = 0; i < ws.length; i++) {
      ws[i].style.opacity = i < active ? "1" : "0.12";
    }
  }

  function updateWords() {
    if (reduced) return;
    var vh = window.innerHeight || 1;
    blocks.forEach(function (b) {
      var p = b.querySelector("p");
      if (!p) return;
      var ws = p.querySelectorAll(".aw");
      var n = ws.length;
      if (!n) return;
      var r = b.getBoundingClientRect();
      var start = vh * 0.95;               // 段落頂部進入畫面底部
      var end = vh * 0.32;                 // 段落頂部到達畫面約 1/3
      var prog = Math.min(1, Math.max(0, (start - r.top) / (start - end)));
      var active = Math.round(prog * n);
      if (lastActive[b.id] !== active) {
        lastActive[b.id] = active;
        for (var i = 0; i < n; i++) ws[i].style.opacity = i < active ? "1" : "0.12";
      }
    });
  }

  function initReveal() {
    prepareWords();
    if (reduced) {
      blocks.forEach(function (b) { setWords(b, 1e9); b.classList.add("in-view"); });
      return;
    }
    blocks.forEach(function (b) { setWords(b, 0); });
    /* 標題／編號：進入視口時淡入（段落文字由捲動逐字驅動） */
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("in-view");
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0.2 });
      blocks.forEach(function (b) { io.observe(b); });
    } else {
      blocks.forEach(function (b) { b.classList.add("in-view"); setWords(b, 1e9); });
    }
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { updateWords(); ticking = false; });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    updateWords();
  }

  if (typeof I18N !== "undefined" && I18N.registerDynamic) {
    I18N.registerDynamic(function () {
      /* 語言切換後 i18n 已重置文字：重新切詞並重跑 */
      blocks.forEach(function (b) {
        var p = b.querySelector("p");
        if (p) p.removeAttribute("data-prepared");
      });
      initReveal();
    });
  }
  /* 等 DOMContentLoaded 之後再切詞：i18n 會在最末再跑一次 applyStatic，
     若先切詞會被 textContent 覆蓋掉 .aw span */
  if (document.readyState === "complete") {
    initReveal();
  } else {
    document.addEventListener("DOMContentLoaded", initReveal);
  }
})();
