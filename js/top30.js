/* 港交所成交額 Top 30 — 最近 30 日平均成交額（進站自動更新）
 * 資料來源：騰訊行情接口（瀏覽器直連，CORS ✅）
 *   - 候選池即時成交額：qt.gtimg.cn（GBK）
 *   - 30 日平均成交額：web.ifzq.gtimg.cn/appstock/app/kline（收市價 × 成交量）
 * 每天首次進入自動抓取一次，結果快取於 localStorage；失敗時退回內建示範資料。
 */
"use strict";

(function () {
  var DAYS = 30;
  var CONCURRENCY = 6;
  var CACHE_KEY = "nora-top30-avg-v1";

  /* ---- 內建示範資料（離線／抓取失敗時的兜底；yi 單位：億港元） ---- */
  var FALLBACK = [
    { code: "09988", cn: "阿里巴巴-W",  en: "Alibaba",     yi: 90.0, color: "#FF6A00", mono: "阿" },
    { code: "00700", cn: "騰訊控股",    en: "Tencent",     yi: 88.0, color: "#12B7F5", mono: "騰" },
    { code: "02513", cn: "智譜",        en: "Z.AI",        yi: 38.0, color: "#3B82F6", mono: "智" },
    { code: "01888", cn: "建滔積層板",  en: "KB Laminates", yi: 36.0, color: "#B51E2D", mono: "建" },
    { code: "00100", cn: "MINIMAX-W",   en: "MiniMax",     yi: 32.0, color: "#6C5CE7", mono: "M" },
    { code: "01810", cn: "小米集團-W",  en: "Xiaomi",      yi: 31.0, color: "#FF6900", mono: "米" },
    { code: "02899", cn: "紫金礦業",    en: "Zijin Mining", yi: 30.0, color: "#E60012", mono: "紫" },
    { code: "03690", cn: "美團-W",      en: "Meituan",     yi: 30.0, color: "#FFD100", mono: "美" },
    { code: "00992", cn: "聯想集團",    en: "Lenovo",      yi: 26.0, color: "#E60012", mono: "聯" },
    { code: "01347", cn: "華虹宏力",    en: "Hua Hong",    yi: 25.0, color: "#005BAC", mono: "華" },
    { code: "00981", cn: "中芯國際",    en: "SMIC",        yi: 24.0, color: "#0E7BD8", mono: "芯" },
    { code: "01299", cn: "友邦保險",    en: "AIA",         yi: 22.0, color: "#002FA7", mono: "友" },
    { code: "02269", cn: "藥明生物",    en: "WuXi Biologics", yi: 21.0, color: "#00A651", mono: "藥" },
    { code: "02259", cn: "紫金黃金國際", en: "Zijin Gold Intl.", yi: 20.0, color: "#C9A227", mono: "金" },
    { code: "03308", cn: "中際旭創",    en: "Innolight",   yi: 19.0, color: "#E5002E", mono: "中" },
    { code: "01024", cn: "快手-W",      en: "Kuaishou",    yi: 18.0, color: "#FF4906", mono: "快" },
    { code: "00883", cn: "中國海洋石油", en: "CNOOC",       yi: 18.0, color: "#0066A1", mono: "海" },
    { code: "06869", cn: "長飛光纖光纜", en: "YOFC",        yi: 17.0, color: "#E60012", mono: "長" },
    { code: "03986", cn: "兆易創新",    en: "GigaDevice",  yi: 17.0, color: "#C8102E", mono: "兆" },
    { code: "02359", cn: "藥明康德",    en: "WuXi AppTec", yi: 17.0, color: "#00A651", mono: "藥" },
    { code: "00388", cn: "香港交易所",  en: "HKEX",        yi: 17.0, color: "#111111", mono: "港" },
    { code: "01548", cn: "金斯瑞生物科技", en: "GenScript", yi: 16.5, color: "#0069B4", mono: "金" },
    { code: "06160", cn: "百濟神州",    en: "BeiGene",     yi: 16.0, color: "#B11116", mono: "百" },
    { code: "00005", cn: "匯豐控股",    en: "HSBC",        yi: 15.0, color: "#DB0011", mono: "匯" },
    { code: "03750", cn: "寧德時代",    en: "CATL",        yi: 15.0, color: "#1A6FB5", mono: "寧" },
    { code: "06809", cn: "瀾起科技",    en: "Montage",     yi: 13.0, color: "#0B5CAD", mono: "瀾" },
    { code: "02318", cn: "中國平安",    en: "Ping An",     yi: 13.0, color: "#E60012", mono: "平" },
    { code: "03330", cn: "靈寶黃金",    en: "Lingbao Gold", yi: 12.5, color: "#B8860B", mono: "靈" },
    { code: "09992", cn: "泡泡瑪特",    en: "Pop Mart",    yi: 12.0, color: "#E6007E", mono: "泡" },
    { code: "02628", cn: "中國人壽",    en: "China Life",  yi: 11.0, color: "#E60012", mono: "壽" }
  ];

  /* ---- 候選池（恒指/國指成分＋大型藍籌＋近期熱門；不含 ETF） ---- */
  var POOL = [
    "00001","00002","00003","00005","00006","00011","00012","00016","00017","00023",
    "00027","00038","00066","00083","00101","00144","00148","00168","00175","00267",
    "00285","00322","00386","00388","00390","00489","00552","00669","00688","00700",
    "00728","00762","00823","00836","00857","00868","00881","00883","00902","00914",
    "00916","00939","00941","00960","00968","00981","00992","00998","01024","01044",
    "01066","01088","01093","01099","01109","01113","01114","01171","01177","01186",
    "01211","01288","01299","01336","01339","01347","01359","01378","01385","01398",
    "01448","01548","01658","01766","01772","01776","01800","01801","01810","01818",
    "01876","01888","01898","01918","01928","01929","01972","01997","02007","02013",
    "02015","02018","02020","02099","02228","02259","02269","02313","02318","02319",
    "02328","02333","02338","02359","02382","02388","02476","02513","02600","02601",
    "02628","02689","02866","02883","02888","02899","03308","03319","03320","03323",
    "03328","03330","03396","03618","03669","03690","03696","03750","03800","03886",
    "03888","03900","03908","03931","03968","03986","03988","03990","03993","06030",
    "06060","06098","06160","06178","06181","06618","06626","06690","06809","06818",
    "06821","06837","06862","06865","06869","06881","06886","09618","09626","09633",
    "09666","09688","09866","09868","09888","09896","09901","09922","09926","09961",
    "09988","09992","09999","00100"
  ];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtYi(yi) {
    if (!isFinite(yi) || yi <= 0) return "--";
    return yi.toFixed(1) + "億";
  }

  function renderList(items, metaText, box, metaEl) {
    box.innerHTML = items.map(function (d, i) {
      var rank = i + 1;
      var en = d.en ? "<small>" + esc(d.en) + "</small>" : "<small></small>";
      var yi = d.yi != null ? d.yi : d.avg / 1e8;
      return '<div class="top30-item" title="' + esc(d.cn + " " + (d.en || "") + " · 日均 " + fmtYi(yi)) + '">' +
        '<span class="top30-rank">' + rank + '</span>' +
        '<span class="top30-badge">' +
        '<img class="top30-logo" src="img/logos/' + esc(d.code) + '.png" alt="' + esc(d.cn) + '" width="56" height="56" loading="lazy" decoding="async" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
        '<span class="top30-mono" style="display:none;background:' + esc(d.color || "#333") + '">' + esc(d.mono || d.cn.charAt(0)) + '</span>' +
        '</span>' +
        '<span class="top30-name">' + esc(d.cn) + en + '</span>' +
        '<span class="top30-code">' + esc(d.code) + ' · 日均 ' + fmtYi(yi) + '</span>' +
        '</div>';
    }).join("");
    if (metaEl) metaEl.textContent = metaText;
  }

  /* 批次即時報價：回傳 code -> {name, amount(HKD)} */
  async function batchQuotes(codes) {
    var out = {};
    for (var i = 0; i < codes.length; i += 50) {
      var chunk = codes.slice(i, i + 50);
      var url = "https://qt.gtimg.cn/q=" + chunk.map(function (c) { return "hk" + c; }).join(",");
      var res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      var text = new TextDecoder("gbk").decode(await res.arrayBuffer());
      text.replace(/v_hk(\d+)="([^"]*)"/g, function (_m, code, line) {
        var p = line.split("~");
        if (p.length > 40) {
          var name = (p[1] || "").trim();
          var amount = parseFloat(p[37]);
          if (amount > 0) out[code] = { name: name, amount: amount };
        }
        return "";
      });
    }
    return out;
  }

  /* 30 日平均成交額（HKD）：Σ(收市價 × 成交量) / N */
  async function avgTurnover(symbol) {
    var url = "https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=" + symbol + ",day,,," + DAYS;
    var res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    var data = await res.json();
    var node = (data.data || {})[symbol] || {};
    var bars = node.day || node.qfqday || [];
    if (!bars.length) return 0;
    var n = Math.min(DAYS, bars.length);
    var sum = 0;
    for (var i = bars.length - n; i < bars.length; i++) {
      var close = parseFloat(bars[i][2]);
      var vol = parseFloat(bars[i][5]);
      if (!isNaN(close) && !isNaN(vol) && close > 0) sum += close * vol;
    }
    return sum / n;
  }

  async function mapLimit(items, limit, fn) {
    var out = new Array(items.length);
    var i = 0;
    async function worker() {
      while (i < items.length) {
        var idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
  }

  async function load() {
    var box = document.getElementById("top30-grid");
    if (!box) return;
    var metaEl = document.getElementById("top30-meta");
    renderList(FALLBACK, "示範資料（更新中…）", box, metaEl);

    try {
      var cached = null;
      try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch (e) { cached = null; }
      var today = new Date().toISOString().slice(0, 10);
      if (cached && cached.date === today && Array.isArray(cached.items) && cached.items.length) {
        renderList(cached.items, "30 日平均成交額 · 快取 " + cached.time, box, metaEl);
        return;
      }

      if (metaEl) metaEl.textContent = "正在抓取 30 日平均成交額…";
      var quotes = await batchQuotes(POOL);
      var cands = Object.keys(quotes).map(function (c) {
        return { code: c, cn: quotes[c].name || c, amount: quotes[c].amount };
      }).filter(function (d) { return d.amount > 0; })
        .sort(function (a, b) { return b.amount - a.amount; })
        .slice(0, 60);

      var avgs = await mapLimit(cands, CONCURRENCY, function (d) {
        return avgTurnover("hk" + d.code).catch(function () { return 0; });
      });

      var enMap = {};
      FALLBACK.forEach(function (f) { enMap[f.code] = f.en; });
      var items = cands.map(function (d, i) {
        return { code: d.code, cn: d.cn, en: enMap[d.code] || "", avg: avgs[i], yi: avgs[i] / 1e8, color: null, mono: null };
      })
      .filter(function (d) { return d.avg > 0; })
      .sort(function (a, b) { return b.avg - a.avg; })
      .slice(0, 30);

      if (!items.length) throw new Error("empty result");

      var now = new Date();
      var timeStr = (now.getMonth() + 1) + "-" + now.getDate() + " " +
        now.getHours() + ":" + String(now.getMinutes()).padStart(2, "0");
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, time: timeStr, items: items }));
      } catch (e) { /* 忽略快取失敗 */ }
      renderList(items, "30 日平均成交額 · 更新於 " + timeStr, box, metaEl);
    } catch (e) {
      console.warn("Top 30 自動更新失敗，使用示範資料", e);
      renderList(FALLBACK, "示範資料（無法連線）", box, metaEl);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }

  /* 手動更新按鈕 */
  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("top30-refresh");
    if (btn) btn.addEventListener("click", function () {
      try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
      load();
    });
  });
})();
