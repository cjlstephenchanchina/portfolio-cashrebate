/* Nora-AI Capital · Cinematic hero 互動
 * - 漢堡按鈕開合全螢幕 mobile menu（clip-path 圓形展開 + stagger）
 * - Esc / 點背景關閉；≥901px 自動關閉；焦點管理與 inert
 * - hero 表單 submit 阻止預設行為
 */
(function () {
  var toggle = document.getElementById('menuToggle');
  var menu = document.getElementById('mobileMenu');
  if (!toggle || !menu) return;

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
})();
