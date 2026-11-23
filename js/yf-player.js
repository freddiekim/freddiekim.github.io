/*
 * YOUNG FINANCE 통합 플레이어 (배경음악 + 분석 음성)
 *
 * 페이지를 옮겨도 소리가 끊기지 않도록, 처음 재생을 시작한 페이지(최상위 문서)가
 * 플레이어를 계속 들고 있고 이후 이동하는 페이지는 그 위에 전체 화면 프레임으로 띄운다.
 * 프레임 안의 페이지에서 누르는 버튼은 모두 최상위 플레이어로 전달된다.
 */
(function () {
  'use strict';

  var RATE_KEY = 'companyAudioPlaybackRate';
  var RATES = [1, 1.25, 1.5, 1.6, 1.7, 2];
  var DEFAULT_RATE = 1.25;

  function readStore(key) {
    try { return window.localStorage ? window.localStorage.getItem(key) : null; } catch (error) { return null; }
  }

  function writeStore(key, value) {
    try { if (window.localStorage) window.localStorage.setItem(key, value); } catch (error) { /* 저장소가 막혀도 재생은 유지 */ }
  }

  function readCatalog(doc) {
    var node = doc.getElementById('yf-audio-catalog');
    if (!node) return null;
    try { return JSON.parse(node.textContent); } catch (error) { return null; }
  }

  function topHost() {
    if (window.top === window.self) return null;
    try { return window.top.YFPlayer || null; } catch (error) { return null; }
  }

  function driveId(url) {
    var text = String(url || '');
    var match = text.match(/drive\.google\.com\/file\/d\/([^/?#]+)/) || text.match(/[?&]id=([^&#]+)/);
    return match ? match[1] : '';
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* ------------------------------------------------------------------ */
  /* 최상위 문서의 플레이어                                                */
  /* ------------------------------------------------------------------ */
  function createHost() {
    var catalog = readCatalog(document) || { music: [], audio: [] };
    var audioTracks = (catalog.audio || []).map(function (track) {
      var id = driveId(track.href);
      return {
        ticker: track.ticker,
        name: track.name || track.ticker,
        title: track.title || '음성 파일',
        href: track.href,
        stream: id ? 'https://drive.usercontent.google.com/download?id=' + id + '&export=open' : track.href,
        preview: id ? 'https://drive.google.com/file/d/' + id + '/preview' : track.href
      };
    });
    var musicTracks = shuffle((catalog.music || []).filter(function (track) { return track.id; }));

    var savedRate = parseFloat(readStore(RATE_KEY));
    var state = {
      mode: null,               // 'music' | 'audio' | null
      musicOn: false,
      musicIndex: 0,
      musicPlaying: false,
      audioIndex: -1,
      audioPlaying: false,
      rate: RATES.indexOf(savedRate) !== -1 ? savedRate : DEFAULT_RATE,
      continuous: true,
      active: false,
      frameOpen: false
    };
    var listeners = [];
    var ui = null;
    var yt = null;
    var audio = null;
    var frame = null;
    var baseTitle = document.title;

    function shuffle(list) {
      var copy = list.slice();
      for (var i = copy.length - 1; i > 0; i -= 1) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
      }
      return copy;
    }

    function snapshot() {
      var music = musicTracks[state.musicIndex];
      var track = audioTracks[state.audioIndex];
      var title = '';
      var kind = '';
      if (state.mode === 'audio' && track) { title = track.title; kind = track.ticker + ' 분석 음성'; }
      else if (state.mode === 'music' && music) { title = music.title; kind = '배경음악'; }
      return {
        mode: state.mode,
        musicOn: state.musicOn,
        playing: state.mode === 'audio' ? state.audioPlaying : state.mode === 'music' ? (state.musicOn) : false,
        title: title,
        kind: kind
      };
    }

    function emit() {
      var snap = snapshot();
      listeners = listeners.filter(function (fn) {
        try { fn(snap); return true; } catch (error) { return false; }
      });
      renderUI();
    }

    function subscribe(fn) {
      listeners.push(fn);
      try { fn(snapshot()); } catch (error) { /* ignore */ }
      return function () { listeners = listeners.filter(function (item) { return item !== fn; }); };
    }

    /* ---------- 배경음악 (YouTube) ---------- */
    function ytCommand(func, args) {
      if (!yt || !yt.contentWindow) return;
      yt.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: args || [] }), '*');
    }

    function ensureYT(startIndex) {
      if (yt) return false;
      if (!musicTracks.length) return false;
      if (startIndex > 0) {
        musicTracks = musicTracks.slice(startIndex).concat(musicTracks.slice(0, startIndex));
      }
      state.musicIndex = 0;
      var ids = musicTracks.map(function (track) { return track.id; });
      yt = document.createElement('iframe');
      yt.className = 'yf-yt';
      yt.title = '배경음악';
      yt.tabIndex = -1;
      yt.setAttribute('aria-hidden', 'true');
      yt.allow = 'autoplay; encrypted-media';
      yt.src = 'https://www.youtube.com/embed/' + ids[0] + '?autoplay=1&controls=0&loop=1&playsinline=1&enablejsapi=1&playlist=' +
        ids.join(',') + '&origin=' + encodeURIComponent(window.location.origin);
      yt.addEventListener('load', function () {
        yt.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'yf-bgm', channel: 'widget' }), '*');
      });
      ensureUI().hidden.appendChild(yt);
      return true;
    }

    window.addEventListener('message', function (event) {
      if (!yt || event.source !== yt.contentWindow) return;
      var data;
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch (error) { return; }
      var info = data && data.info;
      if (!info) return;
      var changed = false;
      if (typeof info.playlistIndex === 'number' && info.playlistIndex !== state.musicIndex) {
        state.musicIndex = info.playlistIndex; changed = true;
      }
      if (typeof info.playerState === 'number') {
        var playing = info.playerState === 1;
        if (playing !== state.musicPlaying) { state.musicPlaying = playing; changed = true; }
      }
      if (changed) emit();
    });

    function playMusic(index) {
      if (!musicTracks.length) return;
      pauseAudio();
      state.mode = 'music';
      state.musicOn = true;
      writeStore('bgm', 'on');
      var created = ensureYT(typeof index === 'number' ? index : 0);
      if (!created) {
        if (typeof index === 'number') { state.musicIndex = index; ytCommand('playVideoAt', [index]); }
        ytCommand('unMute');
        ytCommand('playVideo');
      }
      activate();
      emit();
    }

    function pauseMusic(remember) {
      ytCommand('pauseVideo');
      state.musicOn = false;
      if (remember) writeStore('bgm', 'off');
    }

    function toggleMusic() {
      if (state.musicOn) {
        pauseMusic(true);
        if (state.mode === 'music') state.mode = state.audioIndex >= 0 ? 'audio' : 'music';
        emit();
      } else {
        playMusic();
      }
    }

    /* ---------- 분석 음성 (Google Drive) ---------- */
    function ensureAudio() {
      if (audio) return audio;
      audio = document.createElement('audio');
      audio.preload = 'auto';
      audio.playsInline = true;
      audio.addEventListener('play', function () { applyRate(); state.audioPlaying = true; setStatus(''); mediaState('playing'); emit(); });
      audio.addEventListener('pause', function () { state.audioPlaying = false; mediaState('paused'); emit(); });
      audio.addEventListener('loadedmetadata', applyRate);
      audio.addEventListener('timeupdate', renderProgress);
      audio.addEventListener('durationchange', renderProgress);
      audio.addEventListener('ended', function () {
        state.audioPlaying = false;
        if (state.continuous && audioTracks.length) playAudio((state.audioIndex + 1) % audioTracks.length);
        else emit();
      });
      audio.addEventListener('error', function () {
        var track = audioTracks[state.audioIndex];
        if (!track || !audio.getAttribute('src')) return;
        showPreview(track);
      });
      ensureUI().hidden.appendChild(audio);
      return audio;
    }

    function applyRate() {
      if (!audio) return;
      audio.defaultPlaybackRate = state.rate;
      audio.playbackRate = state.rate;
    }

    function mediaState(value) {
      if ('mediaSession' in navigator) {
        try { navigator.mediaSession.playbackState = value; } catch (error) { /* ignore */ }
      }
    }

    function mediaSession(track) {
      if (!('mediaSession' in navigator)) return;
      try {
        if ('MediaMetadata' in window) {
          navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.name + ' · ' + track.ticker, album: 'YOUNG FINANCE 분석 음성' });
        }
        var handlers = {
          play: function () { audio.play().catch(function () {}); },
          pause: function () { audio.pause(); },
          previoustrack: function () { step(-1); },
          nexttrack: function () { step(1); },
          seekbackward: function () { seek(-15); },
          seekforward: function () { seek(15); }
        };
        Object.keys(handlers).forEach(function (action) {
          try { navigator.mediaSession.setActionHandler(action, handlers[action]); } catch (error) { /* ignore */ }
        });
      } catch (error) { /* ignore */ }
    }

    function playAudio(index) {
      var track = audioTracks[index];
      if (!track) return;
      if (state.musicOn) pauseMusic(false);
      hidePreview();
      state.mode = 'audio';
      state.audioIndex = index;
      var player = ensureAudio();
      player.src = track.stream;
      applyRate();
      mediaSession(track);
      player.play().catch(function () {
        if (player.error || (ui && !ui.preview.hidden) || state.audioIndex !== index) return;
        setStatus('브라우저가 자동재생을 막았습니다. 아래 ▶ 버튼을 한 번 눌러주세요.');
      });
      activate();
      emit();
    }

    function pauseAudio() {
      if (audio && !audio.paused) audio.pause();
      hidePreview();
    }

    function playAudioTicker(ticker) {
      var key = String(ticker || '').toUpperCase();
      for (var i = 0; i < audioTracks.length; i += 1) {
        if (audioTracks[i].ticker === key) {
          playAudio(i);
          openSheet('audio', key);
          return true;
        }
      }
      openSheet('audio');
      return false;
    }

    function seek(seconds) {
      if (!audio || state.mode !== 'audio') return;
      var target = audio.currentTime + seconds;
      if (audio.duration) target = Math.min(audio.duration, target);
      audio.currentTime = Math.max(0, target);
    }

    function setRate(rate) {
      if (RATES.indexOf(rate) === -1) return;
      state.rate = rate;
      writeStore(RATE_KEY, String(rate));
      applyRate();
      emit();
    }

    /* ---------- 공통 조작 ---------- */
    function playPause() {
      if (state.mode === 'audio') {
        if (!audio) return;
        if (audio.paused) audio.play().catch(function () {}); else audio.pause();
      } else {
        toggleMusic();
      }
    }

    function step(direction) {
      if (state.mode === 'audio') {
        if (!audioTracks.length) return;
        playAudio((state.audioIndex + direction + audioTracks.length) % audioTracks.length);
      } else if (state.mode === 'music' && musicTracks.length) {
        state.musicIndex = (state.musicIndex + direction + musicTracks.length) % musicTracks.length;
        playMusic(state.musicIndex);
      }
    }

    function stopAll() {
      pauseMusic(state.mode === 'music');
      if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
      hidePreview();
      state.audioIndex = -1;
      state.audioPlaying = false;
      state.mode = null;
      closeSheet();
      if (!state.frameOpen) {
        state.active = false;
      }
      mediaState('none');
      emit();
    }

    /* ---------- 페이지 이동 시에도 재생 유지 ---------- */
    function activate() {
      state.active = true;
    }

    function isPageLink(link, event) {
      if (!link || event.defaultPrevented || event.button !== 0) return false;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
      if (link.hasAttribute('download')) return false;
      var target = link.getAttribute('target');
      if (target && target !== '_self') return false;
      var raw = link.getAttribute('href') || '';
      if (!raw || raw.charAt(0) === '#' || /^(javascript|mailto|tel):/i.test(raw)) return false;
      var url;
      try { url = new URL(link.href, window.location.href); } catch (error) { return false; }
      if (url.origin !== window.location.origin) return false;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return false;
      return url;
    }

    document.addEventListener('click', function (event) {
      if (!state.active || state.frameOpen) return;
      var link = event.target.closest ? event.target.closest('a[href]') : null;
      var url = isPageLink(link, event);
      if (!url) return;
      event.preventDefault();
      openFrame(url.href);
    });

    function openFrame(href) {
      if (!frame) {
        frame = document.createElement('iframe');
        frame.className = 'yf-frame';
        frame.title = '페이지';
        frame.addEventListener('load', onFrameLoad);
        document.body.appendChild(frame);
      }
      state.frameOpen = true;
      document.documentElement.classList.add('yf-frame-open');
      history.pushState({ yfFrame: true }, '', href);
      frame.src = href;
      renderUI();
    }

    function closeFrame() {
      if (!frame) return;
      state.frameOpen = false;
      document.documentElement.classList.remove('yf-frame-open');
      frame.src = 'about:blank';
      document.title = baseTitle;
      if (state.mode === null) state.active = false;
      renderUI();
    }

    function onFrameLoad() {
      var win;
      var href;
      try {
        win = frame.contentWindow;
        href = win.location.href;
      } catch (error) {
        return; // 다른 도메인으로 이동한 경우: 주소 동기화 생략
      }
      if (!href || href === 'about:blank' || !state.frameOpen) return;
      try { history.replaceState({ yfFrame: true }, '', href); } catch (error) { /* ignore */ }
      if (win.document.title) document.title = win.document.title;
      closeSheet();
      // 외부 링크는 새 탭으로 (프레임 안에서 막히는 사이트 방지)
      win.document.addEventListener('click', function (event) {
        var link = event.target.closest ? event.target.closest('a[href]') : null;
        if (!link || link.getAttribute('target')) return;
        try {
          if (new URL(link.href, win.location.href).origin !== window.location.origin) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener');
          }
        } catch (error) { /* ignore */ }
      }, true);
    }

    window.addEventListener('popstate', function (event) {
      if (state.frameOpen && !(event.state && event.state.yfFrame)) closeFrame();
    });

    /* ---------- 화면 (하단 바 + 목록) ---------- */
    function ensureUI() {
      if (ui) return ui;
      if (!document.getElementById('yf-player-style')) {
        var link = document.createElement('link');
        link.id = 'yf-player-style';
        link.rel = 'stylesheet';
        link.href = '/css/yf-player.css?v=20261123';
        document.head.appendChild(link);
      }

      var root = el('div', 'yf-player');
      root.setAttribute('aria-label', '플레이어');

      var sheet = el('section', 'yf-sheet');
      sheet.hidden = true;
      sheet.setAttribute('aria-label', '음악 · 분석 음성 목록');
      var head = el('div', 'yf-sheet-head');
      var tabs = el('div', 'yf-tabs');
      tabs.setAttribute('role', 'tablist');
      var tabAudio = el('button', 'yf-tab', '분석 음성');
      var tabMusic = el('button', 'yf-tab', '배경음악');
      [tabAudio, tabMusic].forEach(function (tab) { tab.type = 'button'; tab.setAttribute('role', 'tab'); tabs.appendChild(tab); });
      tabAudio.dataset.tab = 'audio';
      tabMusic.dataset.tab = 'music';
      var closeButton = el('button', 'yf-icon', '×');
      closeButton.type = 'button';
      closeButton.setAttribute('aria-label', '목록 닫기');
      head.appendChild(tabs);
      head.appendChild(closeButton);

      var status = el('p', 'yf-status');
      status.hidden = true;
      status.setAttribute('role', 'status');
      var preview = el('div', 'yf-preview');
      preview.hidden = true;

      var audioPane = el('div', 'yf-pane');
      audioPane.dataset.pane = 'audio';
      var tools = el('div', 'yf-tools');
      var rateLabel = el('label', 'yf-rate', '속도 ');
      var rateSelect = document.createElement('select');
      RATES.forEach(function (rate) {
        var option = el('option', null, 'x' + (rate === 2 ? '2.0' : rate));
        option.value = String(rate);
        rateSelect.appendChild(option);
      });
      rateLabel.appendChild(rateSelect);
      var continuousButton = el('button', 'yf-chip', '연속재생 ON');
      continuousButton.type = 'button';
      tools.appendChild(rateLabel);
      tools.appendChild(continuousButton);
      var audioList = el('div', 'yf-list');
      audioPane.appendChild(tools);
      audioPane.appendChild(audioList);

      var musicPane = el('div', 'yf-pane');
      musicPane.dataset.pane = 'music';
      var musicList = el('ol', 'yf-list yf-music-list');
      musicPane.appendChild(musicList);

      sheet.appendChild(head);
      sheet.appendChild(status);
      sheet.appendChild(preview);
      sheet.appendChild(audioPane);
      sheet.appendChild(musicPane);

      var bar = el('div', 'yf-bar');
      bar.hidden = true;
      var playButton = el('button', 'yf-play');
      playButton.type = 'button';
      playButton.innerHTML = '<i class="fa fa-play" aria-hidden="true"></i>';
      var now = el('button', 'yf-now');
      now.type = 'button';
      var nowKind = el('small');
      var nowTitle = el('strong');
      now.appendChild(nowKind);
      now.appendChild(nowTitle);
      var back15 = el('button', 'yf-icon yf-seek', '-15');
      var fwd15 = el('button', 'yf-icon yf-seek', '+15');
      var nextButton = el('button', 'yf-icon');
      nextButton.innerHTML = '<i class="fa fa-step-forward" aria-hidden="true"></i>';
      nextButton.setAttribute('aria-label', '다음');
      var listButton = el('button', 'yf-icon');
      listButton.innerHTML = '<i class="fa fa-list-ul" aria-hidden="true"></i>';
      listButton.setAttribute('aria-label', '목록');
      var stopButton = el('button', 'yf-icon', '×');
      stopButton.setAttribute('aria-label', '재생 끄기');
      [back15, fwd15, nextButton, listButton, stopButton].forEach(function (button) { button.type = 'button'; });
      back15.setAttribute('aria-label', '15초 뒤로');
      fwd15.setAttribute('aria-label', '15초 앞으로');
      var progress = el('div', 'yf-progress');
      var progressFill = el('span');
      progress.appendChild(progressFill);
      bar.appendChild(progress);
      bar.appendChild(playButton);
      bar.appendChild(now);
      bar.appendChild(back15);
      bar.appendChild(fwd15);
      bar.appendChild(nextButton);
      bar.appendChild(listButton);
      bar.appendChild(stopButton);

      var hidden = el('div', 'yf-hidden');

      root.appendChild(sheet);
      root.appendChild(bar);
      root.appendChild(hidden);
      document.body.appendChild(root);

      ui = {
        root: root, sheet: sheet, bar: bar, hidden: hidden, status: status, preview: preview,
        tabs: [tabAudio, tabMusic], panes: [audioPane, musicPane], audioList: audioList, musicList: musicList,
        rateSelect: rateSelect, continuousButton: continuousButton, playButton: playButton, nowKind: nowKind,
        nowTitle: nowTitle, seekButtons: [back15, fwd15], progressFill: progressFill, tab: 'audio'
      };

      tabAudio.addEventListener('click', function () { selectTab('audio'); });
      tabMusic.addEventListener('click', function () { selectTab('music'); });
      closeButton.addEventListener('click', closeSheet);
      rateSelect.addEventListener('change', function () { setRate(parseFloat(rateSelect.value)); });
      continuousButton.addEventListener('click', function () { state.continuous = !state.continuous; renderUI(); });
      playButton.addEventListener('click', playPause);
      now.addEventListener('click', function () { toggleSheet(); });
      back15.addEventListener('click', function () { seek(-15); });
      fwd15.addEventListener('click', function () { seek(15); });
      nextButton.addEventListener('click', function () { step(1); });
      listButton.addEventListener('click', function () { toggleSheet(); });
      stopButton.addEventListener('click', stopAll);
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !sheet.hidden) closeSheet();
      });

      buildLists();
      return ui;
    }

    function buildLists() {
      var lastTicker = '';
      audioTracks.forEach(function (track, index) {
        if (track.ticker !== lastTicker) {
          lastTicker = track.ticker;
          var group = el('p', 'yf-group');
          group.dataset.ticker = track.ticker;
          group.appendChild(el('b', null, track.ticker));
          if (track.name && track.name !== track.ticker) group.appendChild(el('span', null, track.name));
          ui.audioList.appendChild(group);
        }
        var item = el('button', 'yf-item');
        item.type = 'button';
        item.dataset.index = String(index);
        item.appendChild(el('i', 'fa fa-play', null));
        item.appendChild(el('span', null, track.title));
        item.addEventListener('click', function () { playAudio(index); });
        ui.audioList.appendChild(item);
      });
      if (!audioTracks.length) ui.audioList.appendChild(el('p', 'yf-empty', '등록된 분석 음성이 없습니다.'));

      musicTracks.forEach(function (track, index) {
        var li = el('li');
        var item = el('button', 'yf-item');
        item.type = 'button';
        item.dataset.index = String(index);
        item.appendChild(el('b', null, String(index + 1)));
        item.appendChild(el('span', null, track.title));
        item.addEventListener('click', function () { playMusic(index); });
        li.appendChild(item);
        ui.musicList.appendChild(li);
      });
    }

    function rebuildMusicNumbers() {
      // ensureYT가 순서를 회전시킨 경우 목록도 다시 맞춘다
      if (!ui) return;
      ui.musicList.replaceChildren();
      musicTracks.forEach(function (track, index) {
        var li = el('li');
        var item = el('button', 'yf-item');
        item.type = 'button';
        item.dataset.index = String(index);
        item.appendChild(el('b', null, String(index + 1)));
        item.appendChild(el('span', null, track.title));
        item.addEventListener('click', function () { playMusic(index); });
        li.appendChild(item);
        ui.musicList.appendChild(li);
      });
    }

    function selectTab(name) {
      ensureUI();
      ui.tab = name;
      renderUI();
    }

    function openSheet(tab, ticker) {
      ensureUI();
      if (tab) ui.tab = tab;
      ui.sheet.hidden = false;
      renderUI();
      if (ticker) {
        var group = ui.audioList.querySelector('[data-ticker="' + ticker + '"]');
        if (group) ui.sheet.scrollTop = Math.max(0, group.offsetTop - 60);
      }
    }

    function closeSheet() {
      if (!ui) return;
      ui.sheet.hidden = true;
      renderUI();
    }

    function toggleSheet() {
      ensureUI();
      if (ui.sheet.hidden) openSheet(state.mode === 'music' ? 'music' : ui.tab); else closeSheet();
    }

    function setStatus(message) {
      if (!ui) return;
      ui.status.textContent = message || '';
      ui.status.hidden = !message;
      if (message) ui.sheet.hidden = false;
    }

    function showPreview(track) {
      ensureUI();
      if (audio) audio.removeAttribute('src');
      ui.preview.replaceChildren();
      var iframe = document.createElement('iframe');
      iframe.src = track.preview;
      iframe.allow = 'autoplay; encrypted-media';
      iframe.title = track.title;
      ui.preview.appendChild(iframe);
      ui.preview.hidden = false;
      setStatus('직접 재생이 막혀 Google Drive 미리보기로 열었습니다. 미리보기의 재생 버튼을 눌러주세요. (속도 조절은 제한됩니다)');
    }

    function hidePreview() {
      if (!ui || ui.preview.hidden) return;
      ui.preview.replaceChildren();
      ui.preview.hidden = true;
      setStatus('');
    }

    function renderProgress() {
      if (!ui) return;
      var ratio = audio && state.mode === 'audio' && audio.duration ? audio.currentTime / audio.duration : 0;
      ui.progressFill.style.width = (ratio * 100).toFixed(2) + '%';
    }

    var lastMusicOrder = '';
    function renderUI() {
      if (!ui) {
        if (!state.active) return;
        ensureUI();
      }
      var order = musicTracks.map(function (track) { return track.id; }).join(',');
      if (order !== lastMusicOrder) { lastMusicOrder = order; rebuildMusicNumbers(); }

      var snap = snapshot();
      var showBar = state.active || state.frameOpen || !ui.sheet.hidden;
      ui.bar.hidden = !showBar;
      document.documentElement.classList.toggle('yf-bar-on', showBar);

      ui.nowKind.textContent = snap.kind || '음악 · 분석 음성';
      ui.nowTitle.textContent = snap.title || '목록에서 골라 재생하세요';
      var isPlaying = state.mode === 'audio' ? state.audioPlaying : state.mode === 'music' && state.musicOn;
      ui.playButton.innerHTML = '<i class="fa ' + (isPlaying ? 'fa-pause' : 'fa-play') + '" aria-hidden="true"></i>';
      ui.playButton.setAttribute('aria-label', isPlaying ? '일시정지' : '재생');
      ui.playButton.disabled = !state.mode;
      ui.seekButtons.forEach(function (button) { button.hidden = state.mode !== 'audio'; });
      ui.bar.classList.toggle('is-audio', state.mode === 'audio');

      ui.tabs.forEach(function (tab) {
        var on = tab.dataset.tab === ui.tab;
        tab.classList.toggle('is-on', on);
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      ui.panes.forEach(function (pane) { pane.hidden = pane.dataset.pane !== ui.tab; });
      ui.rateSelect.value = String(state.rate);
      ui.continuousButton.textContent = state.continuous ? '연속재생 ON' : '연속재생 OFF';
      ui.continuousButton.classList.toggle('is-on', state.continuous);

      Array.prototype.forEach.call(ui.audioList.querySelectorAll('.yf-item'), function (item) {
        var on = state.mode === 'audio' && Number(item.dataset.index) === state.audioIndex;
        item.classList.toggle('is-current', on);
        item.firstChild.className = 'fa ' + (on && state.audioPlaying ? 'fa-volume-up' : 'fa-play');
      });
      Array.prototype.forEach.call(ui.musicList.querySelectorAll('.yf-item'), function (item) {
        item.classList.toggle('is-current', state.mode === 'music' && state.musicOn && Number(item.dataset.index) === state.musicIndex);
      });
      renderProgress();
    }

    // 브라우저가 소리 있는 자동재생을 막았을 때: 첫 터치/키 입력에서 다시 시도
    function kick() {
      document.removeEventListener('pointerdown', kick, true);
      document.removeEventListener('keydown', kick, true);
      if (state.mode === 'music' && state.musicOn) { ytCommand('unMute'); ytCommand('playVideo'); }
    }
    document.addEventListener('pointerdown', kick, true);
    document.addEventListener('keydown', kick, true);

    function autoStartMusic() {
      if (!musicTracks.length || readStore('bgm') === 'off') return;
      playMusic();
    }

    return {
      subscribe: subscribe,
      playMusic: playMusic,
      toggleMusic: toggleMusic,
      playAudio: playAudio,
      playAudioTicker: playAudioTicker,
      openSheet: openSheet,
      toggleSheet: toggleSheet,
      stop: stopAll,
      autoStartMusic: autoStartMusic,
      audioCount: function (ticker) {
        var key = String(ticker || '').toUpperCase();
        return audioTracks.filter(function (track) { return track.ticker === key; }).length;
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* 모든 페이지: 버튼을 플레이어에 연결                                    */
  /* ------------------------------------------------------------------ */
  var framed = topHost();
  var host = framed || createHost();
  if (!framed) window.YFPlayer = host;
  if (framed) document.documentElement.classList.add('yf-in-frame');

  document.addEventListener('click', function (event) {
    var target = event.target.closest ? event.target.closest('[data-yf-action], .js-audio-playlist-trigger') : null;
    if (!target) return;
    event.preventDefault();
    var action = target.getAttribute('data-yf-action');
    if (action === 'music') host.toggleMusic();
    else if (action === 'sheet') host.toggleSheet();
    else host.playAudioTicker(target.getAttribute('data-audio-ticker'));
  });

  function paintControls(snap) {
    var toggle = document.getElementById('bgm-toggle');
    if (toggle) {
      var label = snap.musicOn ? '배경음악 끄기' : '배경음악 켜기';
      toggle.classList.toggle('is-off', !snap.musicOn);
      toggle.setAttribute('aria-pressed', snap.musicOn ? 'true' : 'false');
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('title', label);
      var icon = toggle.querySelector('i');
      if (icon) icon.className = snap.musicOn ? 'fa fa-volume-up' : 'fa fa-volume-off';
    }
    var now = document.getElementById('bgm-now');
    if (now) now.textContent = snap.title || '음악 · 음성';
  }

  var unsubscribe = host.subscribe(paintControls);
  window.addEventListener('pagehide', function () { if (unsubscribe) unsubscribe(); });

  // 회사 자료에 음성 개수 표시 (자료실 등에서 사용)
  window.YFAudioCount = function (ticker) { return host.audioCount(ticker); };

  if (!framed && document.body.getAttribute('data-yf-autoplay') === 'music') host.autoStartMusic();
})();
