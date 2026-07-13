(function () {
  var VIEWER_ID = "persistent-page-viewer";
  var STYLE_ID = "persistent-page-viewer-style";
  var INTERNAL_PREFIXES = [
    "/pages/",
    "/pages_company/",
    "/pages_html/",
    "/pages_QnA/",
    "/pages_Q_earnings/",
    "/pages_Quarter&Annual/",
    "/pages_conferenceCall/",
    "/pages_portfolio/"
  ];

  function isModifiedClick(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
  }

  function isInternalPage(url) {
    if (url.origin !== window.location.origin) {
      return false;
    }

    return INTERNAL_PREFIXES.some(function (prefix) {
      return url.pathname.indexOf(prefix) === 0;
    });
  }

  function cleanTitle(value) {
    return String(value || "").replace(/\s+/g, " ").trim() || "YOUNG FINANCE";
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "body.persistent-page-viewer-open{overflow:hidden}",
      ".persistent-page-viewer{position:fixed;inset:14px;z-index:1500;background:#fff7e8;border:6px solid #17324d;border-radius:10px;color:#16324a;display:grid;grid-template-rows:auto minmax(0,1fr);box-shadow:0 24px 60px rgba(0,0,0,.36);overflow:hidden}",
      ".persistent-page-viewer[hidden]{display:none!important}",
      ".persistent-page-viewer-head{align-items:center;background:#16324a;border-bottom:6px solid #17324d;color:#fff7e8;display:flex;gap:12px;justify-content:space-between;min-width:0;padding:10px 12px}",
      ".persistent-page-viewer-title{font-family:\"Source Sans Pro\",\"Helvetica Neue\",Arial,sans-serif;font-size:16px;font-weight:900;line-height:1.1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".persistent-page-viewer-actions{display:flex;flex:0 0 auto;gap:8px}",
      ".persistent-page-viewer-actions a,.persistent-page-viewer-actions button{align-items:center;background:#d85b45;border:3px solid #fff7e8;border-radius:6px;color:#fff7e8;display:inline-flex;font-size:15px;font-weight:900;height:38px;justify-content:center;min-width:42px;padding:0 10px;text-decoration:none}",
      ".persistent-page-viewer-actions a{background:#2f7d62}",
      ".persistent-page-viewer-actions button{appearance:none;cursor:pointer}",
      ".persistent-page-viewer-frame{border:0;background:#f6ecd8;height:100%;width:100%}",
      "@media(max-width:720px){.persistent-page-viewer{inset:8px;border-width:4px}.persistent-page-viewer-head{padding:8px}.persistent-page-viewer-title{font-size:14px}.persistent-page-viewer-actions a,.persistent-page-viewer-actions button{height:34px;min-width:38px;padding:0 8px}}"
    ].join("");
    document.head.appendChild(style);
  }

  function ensureViewer() {
    var viewer = document.getElementById(VIEWER_ID);
    if (viewer) {
      return viewer;
    }

    ensureStyles();
    viewer = document.createElement("aside");
    viewer.id = VIEWER_ID;
    viewer.className = "persistent-page-viewer";
    viewer.setAttribute("aria-label", "내부 페이지 보기");
    viewer.hidden = true;
    viewer.innerHTML = [
      '<div class="persistent-page-viewer-head">',
      '  <strong class="persistent-page-viewer-title">YOUNG FINANCE</strong>',
      '  <div class="persistent-page-viewer-actions">',
      '    <a class="persistent-page-viewer-open" href="#" target="_blank" rel="noopener" title="새 탭에서 열기"><i class="fa fa-external-link" aria-hidden="true"></i></a>',
      '    <button class="persistent-page-viewer-close" type="button" title="닫기"><i class="fa fa-times" aria-hidden="true"></i></button>',
      "  </div>",
      "</div>",
      '<iframe class="persistent-page-viewer-frame" title="YOUNG FINANCE page"></iframe>'
    ].join("");

    viewer.querySelector(".persistent-page-viewer-close").addEventListener("click", closeViewer);
    document.body.appendChild(viewer);
    return viewer;
  }

  function openViewer(url, title) {
    var viewer = ensureViewer();
    var frame = viewer.querySelector(".persistent-page-viewer-frame");
    var openLink = viewer.querySelector(".persistent-page-viewer-open");

    viewer.querySelector(".persistent-page-viewer-title").textContent = cleanTitle(title);
    openLink.href = url.href;
    frame.src = url.href;
    viewer.hidden = false;
    document.body.classList.add("persistent-page-viewer-open");
  }

  function closeViewer() {
    var viewer = document.getElementById(VIEWER_ID);
    if (!viewer) {
      return;
    }

    viewer.hidden = true;
    viewer.querySelector(".persistent-page-viewer-frame").src = "about:blank";
    document.body.classList.remove("persistent-page-viewer-open");
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    var link = target && target.closest ? target.closest("a[href]") : null;
    var url;

    if (!link || isModifiedClick(event) || link.hasAttribute("download")) {
      return;
    }

    if (link.target && link.target !== "_self") {
      return;
    }

    url = new URL(link.getAttribute("href"), window.location.href);
    if (!isInternalPage(url)) {
      return;
    }

    event.preventDefault();
    openViewer(url, link.getAttribute("data-viewer-title") || link.textContent || link.getAttribute("title"));
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeViewer();
    }
  });
})();
