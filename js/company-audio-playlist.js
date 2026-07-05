(function () {
  var TRIGGER_SELECTOR = "a.js-audio-playlist-trigger";
  var TRACK_SELECTOR = ".js-audio-track";
  var PANEL_ID = "company-audio-playlist";
  var STYLE_ID = "company-audio-playlist-style";
  var RATE_STORAGE_KEY = "companyAudioPlaybackRate";
  var DEFAULT_PLAYBACK_RATE = 1.25;
  var PLAYBACK_RATES = [1, 1.25, 1.5, 1.6, 1.7, 2];
  var tracks = [];
  var activeIndex = -1;
  var continuous = true;
  var autoplayOnOpen = true;
  var playbackRate = getSavedPlaybackRate();
  var currentAudio = null;
  var playerRequestId = 0;

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function getSavedPlaybackRate() {
    var savedRate;

    try {
      savedRate = parseFloat(window.localStorage.getItem(RATE_STORAGE_KEY));
    } catch (error) {
      return DEFAULT_PLAYBACK_RATE;
    }

    return PLAYBACK_RATES.indexOf(savedRate) !== -1 ? savedRate : DEFAULT_PLAYBACK_RATE;
  }

  function savePlaybackRate(rate) {
    try {
      window.localStorage.setItem(RATE_STORAGE_KEY, String(rate));
    } catch (error) {}
  }

  function getDriveFileId(url) {
    var text = String(url || "");
    var fileMatch = text.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (fileMatch) {
      return fileMatch[1];
    }
    var idMatch = text.match(/[?&]id=([^&]+)/);
    return idMatch ? idMatch[1] : "";
  }

  function getDrivePreviewUrl(url) {
    var id = getDriveFileId(url);
    return id ? "https://drive.google.com/file/d/" + id + "/preview" : url;
  }

  function getDriveStreamUrl(url) {
    var id = getDriveFileId(url);
    return id ? "https://drive.usercontent.google.com/download?id=" + id + "&export=open" : url;
  }

  function isDirectAudio(url) {
    return /\.(mp3|m4a|wav|ogg|aac)(\?|#|$)/i.test(String(url || ""));
  }

  function withAutoplayParam(url) {
    if (!url) {
      return url;
    }
    return url + (url.indexOf("?") === -1 ? "?" : "&") + "autoplay=1";
  }

  function trackFromElement(element) {
    var title = cleanText(element.getAttribute("data-audio-title") || element.getAttribute("title"));
    var ticker = cleanText(element.getAttribute("data-audio-ticker"));
    var href = cleanText(element.getAttribute("data-audio-href") || element.getAttribute("href"));
    var driveId = getDriveFileId(href);

    if (!title) {
      title = cleanText(element.textContent).replace(/^음성\s*:\s*/, "") || "음성 파일";
    }

    return {
      title: title,
      ticker: ticker,
      href: href,
      previewUrl: getDrivePreviewUrl(href),
      streamUrl: driveId ? getDriveStreamUrl(href) : href,
      canUseAudioTag: !!driveId || isDirectAudio(href)
    };
  }

  function collectTracks(ticker) {
    var seen = {};
    var wantedTicker = cleanText(ticker).toUpperCase();
    tracks = [];

    Array.prototype.forEach.call(document.querySelectorAll(TRACK_SELECTOR), function (element) {
      var href = cleanText(element.getAttribute("data-audio-href") || element.getAttribute("href"));
      var linkTicker = cleanText(element.getAttribute("data-audio-ticker")).toUpperCase();
      if (!href || href === "#") {
        return;
      }
      if (wantedTicker && linkTicker !== wantedTicker) {
        return;
      }

      var track = trackFromElement(element);
      var key = track.ticker + "|" + track.title + "|" + track.href;
      if (seen[key]) {
        return;
      }

      seen[key] = true;
      tracks.push(track);
    });

    return tracks;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".company-audio-playlist{position:fixed;right:18px;bottom:18px;z-index:1400;width:min(440px,calc(100vw - 28px));background:#fff7e8;border:5px solid #17324d;border-radius:10px;color:#16324a;font-family:\"Source Sans Pro\",\"Helvetica Neue\",Arial,sans-serif;box-shadow:0 18px 38px rgba(0,0,0,.24);overflow:hidden}",
      ".company-audio-playlist[hidden]{display:none!important}",
      ".company-audio-head{align-items:center;background:#16324a;color:#fff7e8;display:flex;gap:10px;justify-content:space-between;padding:12px 14px}",
      ".company-audio-head strong{font-size:18px;font-weight:900;letter-spacing:0}",
      ".company-audio-close{appearance:none;background:#d85b45;border:3px solid #fff7e8;border-radius:6px;color:#fff7e8;cursor:pointer;font-size:16px;font-weight:900;line-height:1;min-height:34px;padding:5px 9px}",
      ".company-audio-now{padding:14px 14px 10px}",
      ".company-audio-kicker{color:#36526b;font-size:12px;font-weight:900;margin:0 0 4px;text-transform:uppercase}",
      ".company-audio-title{font-size:22px;font-weight:900;line-height:1.1;margin:0 0 8px}",
      ".company-audio-open{color:#16324a;display:inline-flex;font-size:13px;font-weight:900;text-decoration:underline;text-underline-offset:3px}",
      ".company-audio-status{background:rgba(244,201,111,.35);border:2px solid rgba(23,50,77,.22);border-radius:7px;color:#36526b;font-size:13px;font-weight:900;line-height:1.35;margin:8px 14px 0;padding:8px 10px}",
      ".company-audio-status[hidden]{display:none!important}",
      ".company-audio-status.is-warning{background:rgba(216,91,69,.12);color:#8f2f23}",
      ".company-audio-controls{display:flex;flex-wrap:wrap;gap:8px;padding:0 14px 12px}",
      ".company-audio-control{appearance:none;background:#fff;border:3px solid #17324d;border-radius:7px;color:#16324a;cursor:pointer;font-size:13px;font-weight:900;min-height:34px;padding:5px 10px}",
      ".company-audio-control.is-on{background:#f4c96f}",
      ".company-audio-speed{align-items:center;background:#fff;border:3px solid #17324d;border-radius:7px;color:#16324a;display:inline-flex;font-size:13px;font-weight:900;gap:6px;min-height:34px;padding:4px 8px}",
      ".company-audio-speed select{background:#fff7e8;border:0;color:#16324a;cursor:pointer;font:inherit;min-width:64px;outline:0}",
      ".company-audio-speed.is-disabled{opacity:.55}",
      ".company-audio-speed select:disabled{cursor:not-allowed}",
      ".company-audio-frame{background:#17324d;border-top:4px solid #17324d;min-height:80px;padding:8px}",
      ".company-audio-frame iframe,.company-audio-frame audio{background:#fff;border:0;border-radius:6px;display:block;width:100%}",
      ".company-audio-frame iframe{height:168px}",
      ".company-audio-frame audio{height:48px;margin:8px 0}",
      ".company-audio-empty{align-items:center;color:#fff7e8;display:flex;font-weight:900;justify-content:center;min-height:60px}",
      ".company-audio-list{border-top:4px solid #17324d;display:grid;gap:0;max-height:190px;overflow:auto}",
      ".company-audio-item{align-items:center;background:#fff7e8;border:0;border-bottom:2px solid rgba(23,50,77,.2);color:#16324a;cursor:pointer;display:flex;font:inherit;gap:8px;justify-content:space-between;padding:10px 14px;text-align:left;width:100%}",
      ".company-audio-item strong{font-size:15px;font-weight:900}",
      ".company-audio-item span{color:#36526b;font-size:12px;font-weight:900}",
      ".company-audio-item.is-active{background:#f4c96f}",
      ".company-audio-track-source[hidden]{display:none!important}",
      "@media(max-width:560px){.company-audio-playlist{bottom:10px;left:10px;right:10px;width:auto}.company-audio-title{font-size:19px}.company-audio-frame iframe{height:150px}.company-audio-list{max-height:136px}}"
    ].join("");
    document.head.appendChild(style);
  }

  function ensurePanel() {
    var panel = document.getElementById(PANEL_ID);
    if (panel) {
      return panel;
    }

    ensureStyles();

    panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.className = "company-audio-playlist";
    panel.setAttribute("aria-label", "음성 플레이리스트");
    panel.hidden = true;
    panel.innerHTML = [
      '<div class="company-audio-head">',
      "  <strong>음성 플레이리스트</strong>",
      '  <button class="company-audio-close" type="button" aria-label="닫기">×</button>',
      "</div>",
      '<div class="company-audio-now">',
      '  <p class="company-audio-kicker">Audio</p>',
      '  <p class="company-audio-title">재생할 음성을 선택하세요</p>',
      '  <a class="company-audio-open" href="#" target="_blank" rel="noopener noreferrer" hidden>원본 열기</a>',
      "</div>",
      '<p class="company-audio-status" role="status" hidden></p>',
      '<div class="company-audio-controls">',
      '  <button class="company-audio-control company-audio-prev" type="button">이전</button>',
      '  <button class="company-audio-control company-audio-next" type="button">다음</button>',
      '  <label class="company-audio-speed">속도 <select class="company-audio-rate" aria-label="재생 속도"><option value="1">x1</option><option value="1.25" selected>x1.25</option><option value="1.5">x1.5</option><option value="1.6">x1.6</option><option value="1.7">x1.7</option><option value="2">x2.0</option></select></label>',
      '  <button class="company-audio-control company-audio-continuous is-on" type="button" aria-pressed="true">연속재생 ON</button>',
      "</div>",
      '<div class="company-audio-frame" aria-live="polite"><div class="company-audio-empty">Playlist</div></div>',
      '<div class="company-audio-list" role="list"></div>'
    ].join("");

    panel.querySelector(".company-audio-close").addEventListener("click", function () {
      playerRequestId += 1;
      panel.hidden = true;
      panel.querySelector(".company-audio-frame").innerHTML = '<div class="company-audio-empty">Playlist</div>';
      currentAudio = null;
      updateRateControl(panel, false);
      setMediaSessionState("none");
    });
    panel.querySelector(".company-audio-prev").addEventListener("click", function () {
      playPrevious();
    });
    panel.querySelector(".company-audio-next").addEventListener("click", function () {
      playNext();
    });
    panel.querySelector(".company-audio-continuous").addEventListener("click", function () {
      continuous = !continuous;
      updateContinuousButton(panel);
    });
    panel.querySelector(".company-audio-rate").addEventListener("change", function (event) {
      playbackRate = parseFloat(event.target.value) || DEFAULT_PLAYBACK_RATE;
      savePlaybackRate(playbackRate);
      applyPlaybackRate();
    });
    panel.querySelector(".company-audio-rate").value = String(playbackRate);

    document.body.appendChild(panel);
    return panel;
  }

  function setStatus(panel, message, isWarning) {
    var status = panel.querySelector(".company-audio-status");
    status.textContent = message || "";
    status.hidden = !message;
    status.classList.toggle("is-warning", !!isWarning);
  }

  function clearStatus(panel) {
    setStatus(panel, "", false);
  }

  function applyPlaybackRate() {
    if (!currentAudio) {
      return;
    }

    currentAudio.defaultPlaybackRate = playbackRate;
    currentAudio.playbackRate = playbackRate;
  }

  function updateRateControl(panel, enabled) {
    var select = panel.querySelector(".company-audio-rate");
    var label = panel.querySelector(".company-audio-speed");
    if (!select || !label) {
      return;
    }

    select.disabled = !enabled;
    label.classList.toggle("is-disabled", !enabled);
  }

  function setMediaSessionState(state) {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = state;
    }
  }

  function updateMediaSession(track, audio) {
    if (!("mediaSession" in navigator)) {
      return;
    }

    if ("MediaMetadata" in window) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.ticker || "Young Finance",
        album: "Young Finance Audio"
      });
    }

    var actions = {
      play: function () {
        if (audio) {
          audio.play().catch(function () {});
        }
      },
      pause: function () {
        if (audio) {
          audio.pause();
        }
      },
      previoustrack: playPrevious,
      nexttrack: playNext,
      seekbackward: function () {
        if (audio) {
          audio.currentTime = Math.max(0, audio.currentTime - 15);
        }
      },
      seekforward: function () {
        if (audio) {
          audio.currentTime = Math.min(audio.duration || audio.currentTime + 15, audio.currentTime + 15);
        }
      }
    };

    Object.keys(actions).forEach(function (action) {
      try {
        navigator.mediaSession.setActionHandler(action, actions[action]);
      } catch (error) {}
    });
  }

  function updateContinuousButton(panel) {
    var button = panel.querySelector(".company-audio-continuous");
    button.classList.toggle("is-on", continuous);
    button.setAttribute("aria-pressed", continuous ? "true" : "false");
    button.textContent = continuous ? "연속재생 ON" : "연속재생 OFF";
  }

  function renderList(panel) {
    var list = panel.querySelector(".company-audio-list");
    list.innerHTML = "";

    tracks.forEach(function (track, index) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "company-audio-item" + (index === activeIndex ? " is-active" : "");
      item.setAttribute("role", "listitem");
      item.innerHTML = "<strong></strong><span></span>";
      item.querySelector("strong").textContent = track.title;
      item.querySelector("span").textContent = track.ticker || "AUDIO";
      item.addEventListener("click", function () {
        playTrack(index);
      });
      list.appendChild(item);
    });
  }

  function renderEmptyPlayer(panel) {
    panel.querySelector(".company-audio-frame").innerHTML = '<div class="company-audio-empty">Playlist</div>';
    panel.querySelector(".company-audio-title").textContent = "재생할 음성을 선택하세요";
    panel.querySelector(".company-audio-open").hidden = true;
    currentAudio = null;
    updateRateControl(panel, false);
    clearStatus(panel);
  }

  function renderPreviewFrame(panel, track, message) {
    var frameWrap = panel.querySelector(".company-audio-frame");
    frameWrap.innerHTML = "";
    currentAudio = null;
    updateRateControl(panel, false);
    setMediaSessionState("none");

    var iframe = document.createElement("iframe");
    iframe.src = withAutoplayParam(track.previewUrl);
    iframe.allow = "autoplay; encrypted-media";
    iframe.setAttribute("title", track.title);
    frameWrap.appendChild(iframe);
    setStatus(panel, message || "Google Drive 미리보기로 열었습니다. 브라우저가 자동재생을 막으면 미리보기 안의 재생 버튼을 눌러주세요. 미리보기에서는 속도 조절이 제한될 수 있습니다.", true);
  }

  function renderPlayer(panel, track) {
    var requestId = playerRequestId + 1;
    var frameWrap = panel.querySelector(".company-audio-frame");
    playerRequestId = requestId;
    frameWrap.innerHTML = "";
    clearStatus(panel);

    if (!track.canUseAudioTag) {
      renderPreviewFrame(panel, track);
      return;
    }

    var audio = document.createElement("audio");
    currentAudio = audio;
    audio.controls = true;
    audio.autoplay = true;
    audio.preload = "auto";
    audio.playsInline = true;
    audio.crossOrigin = "anonymous";
    audio.defaultPlaybackRate = playbackRate;
    audio.playbackRate = playbackRate;
    audio.addEventListener("loadedmetadata", applyPlaybackRate);
    audio.addEventListener("canplay", applyPlaybackRate, { once: true });
    audio.addEventListener("ended", function () {
      if (continuous) {
        playNext();
      } else {
        setMediaSessionState("none");
      }
    });
    audio.addEventListener("play", function () {
      applyPlaybackRate();
      clearStatus(panel);
      setMediaSessionState("playing");
    });
    audio.addEventListener("pause", function () {
      setMediaSessionState("paused");
    });
    audio.addEventListener("error", function () {
      if (requestId !== playerRequestId) {
        return;
      }
      renderPreviewFrame(panel, track, getDriveFileId(track.href) ? "Google Drive 미리보기로 열었습니다. Drive 보안 정책상 사이트의 속도 조절과 연속재생은 제한됩니다." : "오디오 직접 재생이 막혀 미리보기로 열었습니다. 이 경우 속도 조절과 연속재생은 제한될 수 있습니다.");
    }, { once: true });
    frameWrap.appendChild(audio);
    updateRateControl(panel, true);
    updateMediaSession(track, audio);
    audio.src = track.streamUrl;

    function startPlayback() {
      audio.play().catch(function () {
        setStatus(panel, "브라우저가 자동재생을 막았습니다. 플레이어의 재생 버튼을 한 번 눌러주세요.", true);
        setMediaSessionState("paused");
      });
    }

    startPlayback();
  }

  function setCurrentTrack(panel, track) {
    var openLink = panel.querySelector(".company-audio-open");
    panel.querySelector(".company-audio-title").textContent = track.title;
    panel.querySelector(".company-audio-kicker").textContent = track.ticker ? track.ticker + " Audio" : "Audio";
    openLink.href = track.href;
    openLink.hidden = false;
  }

  function playTrack(index) {
    var panel = ensurePanel();
    var track = tracks[index];
    if (!track) {
      return;
    }

    activeIndex = index;
    panel.hidden = false;
    setCurrentTrack(panel, track);
    renderPlayer(panel, track);
    renderList(panel);
    updateContinuousButton(panel);
  }

  function playNext() {
    if (!tracks.length) {
      return;
    }
    var nextIndex = activeIndex + 1;
    if (nextIndex >= tracks.length) {
      nextIndex = continuous ? 0 : tracks.length - 1;
    }
    playTrack(nextIndex);
  }

  function playPrevious() {
    if (!tracks.length) {
      return;
    }
    var previousIndex = activeIndex - 1;
    if (previousIndex < 0) {
      previousIndex = tracks.length - 1;
    }
    playTrack(previousIndex);
  }

  function openPlaylist(ticker) {
    var panel = ensurePanel();
    collectTracks(ticker);
    activeIndex = -1;
    panel.hidden = false;
    panel.querySelector(".company-audio-kicker").textContent = ticker ? ticker + " Audio" : "Audio";
    renderEmptyPlayer(panel);
    renderList(panel);
    updateContinuousButton(panel);
    if (autoplayOnOpen && tracks.length) {
      playTrack(0);
    }
  }

  function handlePlaylistTrigger(event) {
    var target = event.target;
    var trigger = target && target.closest ? target.closest(TRIGGER_SELECTOR) : null;
    if (!trigger) {
      return;
    }

    event.preventDefault();
    openPlaylist(trigger.getAttribute("data-audio-ticker"));
  }

  document.addEventListener("click", handlePlaylistTrigger);
})();
