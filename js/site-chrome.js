(function () {
  'use strict';

  function readStore(key) {
    try { return window.localStorage ? window.localStorage.getItem(key) : null; } catch (error) { return null; }
  }

  function writeStore(key, value) {
    try { if (window.localStorage) window.localStorage.setItem(key, value); } catch (error) { /* 저장소가 막혀도 동작은 유지 */ }
  }

  /* 왼쪽 위 이미지: 클릭하면 주간/야간 이미지 전환 */
  function setupTheme() {
    var toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    var root = document.documentElement;
    var favicon = document.querySelector('link[rel="icon"]');

    function apply(theme) {
      var isNight = theme === 'night';
      root.classList.toggle('theme-night', isNight);
      var label = isNight ? '주간 이미지로 전환' : '야간 이미지로 전환';
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('title', label);
      toggle.setAttribute('aria-pressed', isNight ? 'true' : 'false');
      if (favicon) favicon.href = toggle.getAttribute(isNight ? 'data-night' : 'data-day');
    }

    apply(readStore('theme'));
    toggle.addEventListener('click', function () {
      var next = root.classList.contains('theme-night') ? 'day' : 'night';
      writeStore('theme', next);
      apply(next);
    });
  }

  setupTheme();
})();
