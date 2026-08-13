/* ============================================================================
 * aurora-bg.js — 全站統一 WebGL 流體極光背景層
 * 純原生 WebGL + GLSL（無任何外部 JS / 圖片依賴）。
 * 設計：純黑大背景 + 偶爾幾道藍青/琥珀色眩光緩慢飄動（不油膩、不搶內容）。
 * 此檔僅負責「最底層背景」，不影響任何站點結構、導覽或內容。
 * 整合自 aurora-bg.html demo；針對 portfolio dashboard 調整為「各處皆自然可見」，
 * 不再需要滾動後才浮現（站點本身已有 hero-cinema 影片與其底部溶解）。
 * ==========================================================================*/
(function () {
  "use strict";

  var canvas = document.getElementById("aurora-canvas");
  if (!canvas) return;

  var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    // 無 WebGL 時靜默降級：html 背景 #06080E 作為兜底，不破壞既有深色設計。
    return;
  }

  /* ── 頂點著色器：全屏兩三角形 ── */
  var VERT = [
    "attribute vec2 a_pos;",
    "void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }"
  ].join("\n");

  /* ── 片元著色器：Simplex + FBM 流體極光 ── */
  var FRAG = [
    "precision highp float;",
    "uniform vec2  u_resolution;",
    "uniform float u_time;",
    "uniform vec2  u_mouse;",   // 歸一化 -1..1
    "uniform float u_scroll;",  // 滾動進度（已平滑）
    "uniform float u_theme;",   // 0=深夜（黑底） / 1=白天（近白底）

    // ---- Ashima Simplex Noise 3D ----
    "vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}",
    "vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}",
    "vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}",
    "vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}",
    "float snoise(vec3 v){",
    "  const vec2 C = vec2(1.0/6.0, 1.0/3.0);",
    "  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);",
    "  vec3 i  = floor(v + dot(v, C.yyy));",
    "  vec3 x0 = v - i + dot(i, C.xxx);",
    "  vec3 g = step(x0.yzx, x0.xyz);",
    "  vec3 l = 1.0 - g;",
    "  vec3 i1 = min(g.xyz, l.zxy);",
    "  vec3 i2 = max(g.xyz, l.zxy);",
    "  vec3 x1 = x0 - i1 + C.xxx;",
    "  vec3 x2 = x0 - i2 + C.yyy;",
    "  vec3 x3 = x0 - D.yyy;",
    "  i = mod289(i);",
    "  vec4 p = permute( permute( permute(",
    "             i.z + vec4(0.0, i1.z, i2.z, 1.0))",
    "           + i.y + vec4(0.0, i1.y, i2.y, 1.0))",
    "           + i.x + vec4(0.0, i1.x, i2.x, 1.0));",
    "  float n_ = 0.142857142857;",
    "  vec3 ns = n_ * D.wyz - D.xzx;",
    "  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);",
    "  vec4 x_ = floor(j * ns.z);",
    "  vec4 y_ = floor(j - 7.0 * x_);",
    "  vec4 x = x_ * ns.x + ns.yyyy;",
    "  vec4 y = y_ * ns.x + ns.yyyy;",
    "  vec4 h = 1.0 - abs(x) - abs(y);",
    "  vec4 b0 = vec4(x.xy, y.xy);",
    "  vec4 b1 = vec4(x.zw, y.zw);",
    "  vec4 s0 = floor(b0)*2.0 + 1.0;",
    "  vec4 s1 = floor(b1)*2.0 + 1.0;",
    "  vec4 sh = -step(h, vec4(0.0));",
    "  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;",
    "  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;",
    "  vec3 p0 = vec3(a0.xy, h.x);",
    "  vec3 p1 = vec3(a0.zw, h.y);",
    "  vec3 p2 = vec3(a1.xy, h.z);",
    "  vec3 p3 = vec3(a1.zw, h.w);",
    "  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));",
    "  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;",
    "  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);",
    "  m = m * m;",
    "  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));",
    "}",

    // ---- FBM 分形布朗運動 ----
    "float fbm(vec3 p){",
    "  float v = 0.0;",
    "  float a = 0.5;",
    "  for(int i=0;i<4;i++){",
    "    v += a * snoise(p);",
    "    p *= 2.0;",
    "    a *= 0.5;",
    "  }",
    "  return v;",
    "}",

    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / u_resolution.xy;",
    "  vec2 p = uv;",
    "  p.x *= u_resolution.x / u_resolution.y;",

    "  float t = u_time * 0.045;",
    "  vec2 m = u_mouse * 0.05;",

    // 低頻 noise 決定眩光出現位置（極少數區域觸發）
    "  vec3 q  = vec3(p.x*1.2 + m.x, p.y*1.2 + m.y - t*0.3, t);",
    "  float n = fbm(q);",

    // 眩光點：noise 峰值觸發
    "  float glow = pow(max(0.0, n - 0.15), 3.5) * 2.5;",
    // 白天時降低眩光強度，避免過曝
    "  glow *= mix(1.0, 0.45, u_theme);",

    // 眩光顏色：藍青為主，偶爾暖色
    "  float colorVar = fbm(vec3(p*3.0, t*0.2));",
    "  vec3  glowCool = mix(vec3(0.35, 0.65, 1.0), vec3(0.72, 0.84, 1.0), u_theme);",   // 藍青（白天→柔和淺藍）
    "  vec3  glowWarm = mix(vec3(1.0, 0.68, 0.25), vec3(0.98, 0.87, 0.60), u_theme);", // 琥珀（白天→柔和淺暖）
    "  vec3  glowColor = mix(glowCool, glowWarm, smoothstep(0.5, 0.8, colorVar));",

    // 眩光柔暈
    "  float halo = exp(-glow * 1.2) * glow * 0.8;",
    "  vec3  glowCol = glowColor * (glow + halo);",

    // 極慢呼吸
    "  glowCol *= 0.90 + 0.10 * sin(t * 0.25);",

    // tonemap（降低分母讓暗部也有一點光）
    "  glowCol = glowCol / (glowCol + 0.55);",

    // 基底：深夜純黑 / 白天近白
    "  vec3 base = mix(vec3(0.0, 0.0, 0.0), vec3(0.963, 0.975, 0.996), u_theme);",

    // 各處皆自然可見：滾動略增強（0.7→1.0），但不依賴滾動才出現
    "  float vis = 0.7 + 0.3 * smoothstep(0.0, 1.5, u_scroll);",
    "  vec3 col = base + glowCol * vis;",

    // 極淡暗角
    "  float vig = smoothstep(1.3, 0.2, length(uv - 0.5));",
    "  col *= mix(0.85, 1.0, vig);",

    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("aurora shader error:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("aurora link error:", gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  // 全屏 quad
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1,  -1, 1,
    -1,  1,  1, -1,   1, 1
  ]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var uRes   = gl.getUniformLocation(prog, "u_resolution");
  var uTime  = gl.getUniformLocation(prog, "u_time");
  var uMouse = gl.getUniformLocation(prog, "u_mouse");
  var uScroll= gl.getUniformLocation(prog, "u_scroll");
  var uTheme = gl.getUniformLocation(prog, "u_theme");

  // ── 尺寸 / 降採樣（極光本就朦朧，低內部分辨率看不出差別，卻大幅省 GPU） ──
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var scale = 0.5;
    if (window.innerWidth < 768) scale = 0.4;      // 手機更激進降採樣
    else if (window.innerWidth < 1280) scale = 0.45;
    var w = Math.floor(window.innerWidth * dpr * scale);
    var h = Math.floor(window.innerHeight * dpr * scale);
    var cap = 1600;
    if (w > cap) { var k = cap / w; w = cap; h = Math.floor(h * k); }
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  // ── 互動狀態（皆做 lerp 平滑，避免跳變） ──
  var targetScroll = 0, curScroll = 0;
  var targetMouse = [0, 0], curMouse = [0, 0];

  function onScroll() {
    var h = window.innerHeight || 1;
    targetScroll = Math.max(window.scrollY / h, 0);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ── 主題（0=深夜 / 1=白天）：全站已僅保留深夜模式，固定為 0 ── */
  function readTheme() {
    return document.documentElement.getAttribute("data-theme") === "day" ? 1 : 0;
  }
  var curTheme = readTheme();
  var targetTheme = curTheme;
  window.AuroraBG = {
    setTheme: function (theme) {
      targetTheme = theme === "day" ? 1 : 0;
    }
  };

  window.addEventListener("mousemove", function (e) {
    targetMouse[0] = (e.clientX / window.innerWidth) * 2 - 1;
    targetMouse[1] = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  // ── 渲染迴圈（頁面不可見時暫停） ──
  var reduce = window.matchMedia &&
               window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var timeScale = reduce ? 0.25 : 1.0;
  var start = performance.now();
  var rafId = null;
  var running = false;

  function frame(now) {
    curScroll += (targetScroll - curScroll) * 0.08;
    curMouse[0] += (targetMouse[0] - curMouse[0]) * 0.05;
    curMouse[1] += (targetMouse[1] - curMouse[1]) * 0.05;
    curTheme += (targetTheme - curTheme) * 0.04;

    var t = (now - start) * 0.001 * timeScale;

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uMouse, curMouse[0], curMouse[1]);
    gl.uniform1f(uScroll, curScroll);
    gl.uniform1f(uTheme, curTheme);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    rafId = requestAnimationFrame(frame);
  }

  function startLoop() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  }
  function stopLoop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopLoop();
    else startLoop();
  });

  startLoop();
})();
