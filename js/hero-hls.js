/* =====================================================================
 * Nora-AI Capital · Hero 背景影片（HLS 串流，CodeNest 風格）
 *  - 優先使用 hls.js（enableWorker:false，沙箱環境更穩定）
 *  - Safari 等原生支援 m3u8 的瀏覽器直接掛 src
 *  - 影片 60% 不透明度由 CSS 控制，自動循環播放
 * ===================================================================== */
(function () {
  "use strict";

  var video = document.querySelector(".hero-cinema__media video");
  if (!video) return;
  var source = video.querySelector("source");
  var src = (source && source.getAttribute("src")) || video.getAttribute("src");
  if (!src) return;

  if (window.Hls && Hls.isSupported()) {
    var hls = new Hls({ enableWorker: false });
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, function () {
      video.muted = true;
      video.loop = true;
      var p = video.play();
      if (p && p.catch) p.catch(function () { /* autoplay policy 時忽略 */ });
    });
    hls.on(Hls.Events.ERROR, function (_e, data) {
      if (data && data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
      }
    });
    video.addEventListener("ended", function () {
      try { video.currentTime = 0; var p = video.play(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ }
    });
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = src;
    video.muted = true;
    video.loop = true;
    var p2 = video.play();
    if (p2 && p2.catch) p2.catch(function () { /* ignore */ });
    video.addEventListener("ended", function () {
      try { video.currentTime = 0; video.play(); } catch (e) { /* ignore */ }
    });
  }
})();
