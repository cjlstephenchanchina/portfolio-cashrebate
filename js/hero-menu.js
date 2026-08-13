/* Nora-AI Capital · Cinematic hero 互動
 * - 漢堡按鈕開合全螢幕 mobile menu（clip-path 圓形展開 + stagger）
 * - Esc / 點背景關閉；≥901px 自動關閉；焦點管理與 inert
 * - hero 表單 submit 阻止預設行為
 * - 站體導覽 scroll-spy：當前章節高亮 + 滑動指示條跟隨
 * - 站體導覽滾動後切換到 .scrolled（毛玻璃）狀態
 */
(function () {
  /* 頁面載入完成後啟用 header 過渡（消除整頁跳轉時的一動一動） */
  function enableNavTransitions() {
    document.body.classList.add("nav-ready");
  }
  window.addEventListener("load", enableNavTransitions);
  if (document.readyState === "complete") enableNavTransitions();

  var toggle = document.getElementById('menuToggle');
  var menu = document.getElementById('mobileMenu');
  if (toggle && menu) {

  function openMenu() {
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    if ('inert' in menu) menu.inert = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('menu-open');
    var first = menu.querySelector('.m-link');
    if (first) first.focus();
  }

  function closeMenu(restoreFocus) {
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    if ('inert' in menu) menu.inert = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('menu-open');
    if (restoreFocus && toggle) toggle.focus();
  }

  toggle.addEventListener('click', function () {
    if (menu.classList.contains('is-open')) closeMenu(true);
    else openMenu();
  });

  // 點背景（非連結/CTA）關閉
  menu.addEventListener('click', function (e) {
    if (e.target === menu) closeMenu(true);
  });

  // Esc 關閉
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu(true);
  });

  // 跨過桌面斷點自動關閉
  var mq = window.matchMedia('(min-width: 901px)');
  function handleMq(e) { if (e.matches) closeMenu(false); }
  if (mq.addEventListener) mq.addEventListener('change', handleMq);
  else if (mq.addListener) mq.addListener(handleMq);

  // hero 表單：阻止預設提交
  var form = document.querySelector('.hc-form');
  if (form) form.addEventListener('submit', function (e) { e.preventDefault(); });

  }  // end if (toggle && menu)

  /* ===================== 站體導覽：scroll-spy + 滑動指示條 + 滾動狀態 ===================== */
  var nav = document.getElementById('siteNav');
  var navLinks = document.getElementById('navLinks');
  var indicator = document.getElementById('navIndicator');
  if (!nav || !navLinks || !indicator) return;

  var linkEls = Array.prototype.slice.call(navLinks.querySelectorAll('a'));
  var idByHref = function (link) { return (link.getAttribute('href') || '').replace(/^#/, ''); };

  /* 將指示條移到指定 link 下方 */
  function moveIndicator(targetLink, animate) {
    if (!targetLink) return;
    var parent = targetLink.parentElement;        /* nav-links */
    var rect = targetLink.getBoundingClientRect();
    var parentRect = parent.getBoundingClientRect();
    var x = rect.left - parentRect.left;
    var w = rect.width;
    if (!animate) {
      indicator.style.transition = 'none';
    }
    indicator.style.width = w + 'px';
    indicator.style.left = x + 'px';
    if (!animate) {
      /* 强制 reflow 后恢复 transition */
      void indicator.offsetWidth;
      indicator.style.transition = '';
    }
  }

  /* 高亮當前 link */
  function setActive(id, animate) {
    var links = navLinks.querySelectorAll('a');
    var match = null;
    for (var i = 0; i < links.length; i++) {
      var isMatch = idByHref(links[i]) === id;
      if (isMatch) {
        if (!links[i].classList.contains('active')) {
          links[i].classList.add('active');
        }
        match = links[i];
      } else if (links[i].classList.contains('active')) {
        links[i].classList.remove('active');
      }
    }
    if (match) moveIndicator(match, animate !== false);
  }

  /* ---------- 點擊處理：先高亮再 smooth scroll ---------- */
  linkEls.forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = idByHref(link);
      var target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      setActive(id, true);
      /* 使用原生 #anchor 跳轉；scroll-margin-top 已設好 sticky 偏移 */
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', '#' + id);
    });
  });

  /* ---------- Scroll-spy：IntersectionObserver ---------- */
  var sectionIds = ['quote', 'batch', 'stats', 'overview', 'history'];
  var sectionEls = sectionIds
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);

  /* 預設高亮第一個 section（即使還未進入視口） */
  if (linkEls.length) setActive(idByHref(linkEls[0]), false);

  if ('IntersectionObserver' in window && sectionEls.length) {
    /* 透過「視口中段」判定：rootMargin 把偵測區縮到畫面中段一條，讓滾動至某 section
       中央時切換 active，更接近使用者主觀視覺 */
    var spyIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id, true);
      });
    }, {
      rootMargin: '-40% 0px -55% 0px',
      threshold: 0
    });
    sectionEls.forEach(function (s) { spyIO.observe(s); });
  }

  /* ---------- 滾動後切 .scrolled（hero 之上透明，滾下毛玻璃） ---------- */
  function updateScrolled() {
    /* 頁面載入完成前不切玻璃化，避免整頁跳轉時 header 抽動 */
    if (!document.body.classList.contains('nav-ready')) return;
    var st = window.pageYOffset || document.documentElement.scrollTop || 0;
    /* 過了 hero 後切換；用 hero 高度比較更精準；此處用 80px 當門檻與 hero 頂部區隔 */
    if (st > 80) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }
  updateScrolled();
  window.addEventListener('scroll', updateScrolled, { passive: true });
  window.addEventListener('resize', function () {
    /* resize 後重新定位指示條（避免字寬變動） */
    var active = navLinks.querySelector('a.active') || linkEls[0];
    if (active) moveIndicator(active, false);
    updateScrolled();
  });
})();
