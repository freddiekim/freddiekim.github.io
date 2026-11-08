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

  /* 배경음악: 유튜브 플레이리스트 + 목록 */
  function setupBgm() {
    var box = document.querySelector('[data-bgm]');
    if (!box) return;
    var frame = document.getElementById('background-music-frame');
    var toggle = document.getElementById('bgm-toggle');
    var listToggle = document.getElementById('bgm-list-toggle');
    var panel = document.getElementById('bgm-track-list');
    var nowLabel = document.getElementById('bgm-now');
    var list = panel.querySelector('ol');
    var items = Array.prototype.slice.call(list.children);

    // 매번 다른 순서로 재생
    for (var i = items.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = items[i]; items[i] = items[j]; items[j] = tmp;
    }
    items.forEach(function (item, index) {
      item.querySelector('b').textContent = String(index + 1);
      list.appendChild(item);
    });

    var buttons = items.map(function (item) { return item.querySelector('.bgm-track'); });
    var ids = buttons.map(function (button) { return button.getAttribute('data-youtube-id'); }).filter(Boolean);
    if (!ids.length) { box.hidden = true; return; }

    var isOn = readStore('bgm') !== 'off';
    var origin = encodeURIComponent(window.location.origin);
    frame.src = 'https://www.youtube.com/embed/' + ids[0] + '?autoplay=' + (isOn ? 1 : 0) +
      '&controls=0&loop=1&playlist=' + ids.join(',') + '&enablejsapi=1&playsinline=1&origin=' + origin;

    function command(func, args) {
      if (!frame.contentWindow) return;
      frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: args || [] }), '*');
    }

    function markCurrent(index) {
      buttons.forEach(function (button, i) {
        var active = i === index;
        button.classList.toggle('is-playing', active);
        if (active) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
      });
      if (buttons[index] && nowLabel) nowLabel.textContent = buttons[index].querySelector('em').textContent;
    }

    function render() {
      var label = isOn ? '배경음악 끄기' : '배경음악 켜기';
      toggle.classList.toggle('is-off', !isOn);
      toggle.setAttribute('aria-pressed', isOn ? 'true' : 'false');
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('title', label);
      toggle.querySelector('i').className = isOn ? 'fa fa-volume-up' : 'fa fa-volume-off';
    }

    function setOn(next) {
      isOn = next;
      writeStore('bgm', isOn ? 'on' : 'off');
      render();
      if (isOn) { command('unMute'); command('playVideo'); } else { command('pauseVideo'); }
    }

    toggle.addEventListener('click', function () { setOn(!isOn); });

    listToggle.addEventListener('click', function (event) {
      event.stopPropagation();
      panel.hidden = !panel.hidden;
      listToggle.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
    });
    document.addEventListener('click', function (event) {
      if (!panel.hidden && !box.contains(event.target)) {
        panel.hidden = true;
        listToggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hidden) {
        panel.hidden = true;
        listToggle.setAttribute('aria-expanded', 'false');
        listToggle.focus();
      }
    });

    buttons.forEach(function (button, index) {
      button.addEventListener('click', function () {
        markCurrent(index);
        command('playVideoAt', [index]);
        if (!isOn) setOn(true); else command('unMute');
      });
    });

    // 현재 재생 곡 표시를 위해 유튜브 플레이어 이벤트 구독
    frame.addEventListener('load', function () {
      frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'bgm' }), '*');
    });
    window.addEventListener('message', function (event) {
      if (!/youtube(-nocookie)?\.com$/.test(event.origin.replace(/^https?:\/\/(www\.)?/, ''))) return;
      var data;
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch (error) { return; }
      if (data && data.info && typeof data.info.playlistIndex === 'number') markCurrent(data.info.playlistIndex);
    });

    // 브라우저가 소리 있는 자동재생을 막으면 첫 클릭/키 입력 때 재생
    function kick() {
      document.removeEventListener('pointerdown', kick, true);
      document.removeEventListener('keydown', kick, true);
      if (isOn) { command('unMute'); command('playVideo'); }
    }
    document.addEventListener('pointerdown', kick, true);
    document.addEventListener('keydown', kick, true);

    markCurrent(0);
    render();
  }

  setupTheme();
  setupBgm();
})();
