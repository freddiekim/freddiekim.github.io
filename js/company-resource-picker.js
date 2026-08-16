(function () {
  var TRIGGER_SELECTOR = "a.js-company-resource-trigger";
  var ITEM_SELECTOR = ".js-company-resource-item";
  var PANEL_ID = "company-resource-picker";
  var STYLE_ID = "company-resource-picker-style";
  var KIND_LABELS = {
    overview: "개요",
    report: "기업분석",
    qa: "QnA",
    quarter: "분기자료",
    summary: "분기자료 요약",
    "call-summary": "어닝콜 요약"
  };

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".company-resource-picker{position:fixed;right:18px;bottom:18px;z-index:1390;width:min(440px,calc(100vw - 28px));background:#fff7e8;border:5px solid #17324d;border-radius:8px;color:#16324a;font-family:\"Source Sans Pro\",\"Helvetica Neue\",Arial,sans-serif;box-shadow:0 18px 38px rgba(0,0,0,.24);overflow:hidden}",
      ".company-resource-picker[hidden]{display:none!important}",
      ".company-resource-head{align-items:center;background:#16324a;color:#fff7e8;display:flex;gap:10px;justify-content:space-between;padding:12px 14px}",
      ".company-resource-head strong{font-size:18px;font-weight:900;letter-spacing:0}",
      ".company-resource-close{appearance:none;background:#d85b45;border:3px solid #fff7e8;border-radius:6px;color:#fff7e8;cursor:pointer;font-size:16px;font-weight:900;line-height:1;min-height:34px;padding:5px 9px}",
      ".company-resource-summary{background:#f4c96f;border-bottom:4px solid #17324d;padding:12px 14px}",
      ".company-resource-summary span{color:#36526b;display:block;font-size:12px;font-weight:900;margin-bottom:2px;text-transform:uppercase}",
      ".company-resource-summary strong{display:block;font-size:22px;font-weight:900;line-height:1.1}",
      ".company-resource-list{display:grid;max-height:360px;overflow:auto}",
      ".company-resource-item{align-items:center;background:#fff7e8;border:0;border-bottom:2px solid rgba(23,50,77,.22);color:#16324a;display:flex;gap:14px;justify-content:space-between;min-height:58px;padding:11px 14px;text-decoration:none}",
      ".company-resource-item:hover,.company-resource-item:focus{background:#9fd2d6;color:#16324a;text-decoration:none}",
      ".company-resource-item strong{display:block;font-size:16px;font-weight:900;line-height:1.2}",
      ".company-resource-item span{color:#36526b;display:block;font-size:12px;font-weight:900;margin-top:3px}",
      ".company-resource-arrow{font-size:24px;font-weight:900;line-height:1}",
      ".js-company-resource-item[hidden]{display:none!important}",
      "@media(max-width:560px){.company-resource-picker{bottom:10px;left:10px;right:10px;width:auto}.company-resource-list{max-height:52vh}.company-resource-summary strong{font-size:19px}}"
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
    panel.className = "company-resource-picker";
    panel.setAttribute("aria-label", "기업 자료 선택");
    panel.hidden = true;
    panel.innerHTML = [
      '<div class="company-resource-head">',
      "  <strong>기업 자료 선택</strong>",
      '  <button class="company-resource-close" type="button" aria-label="닫기">×</button>',
      "</div>",
      '<div class="company-resource-summary">',
      '  <span class="company-resource-ticker">Company</span>',
      '  <strong class="company-resource-title">자료를 선택하세요</strong>',
      "</div>",
      '<div class="company-resource-list"></div>'
    ].join("");
    panel.querySelector(".company-resource-close").addEventListener("click", function () {
      panel.hidden = true;
    });
    document.body.appendChild(panel);
    return panel;
  }

  function collectItems(ticker, kind) {
    var wantedTicker = cleanText(ticker).toUpperCase();
    var seen = {};
    var items = [];

    Array.prototype.forEach.call(document.querySelectorAll(ITEM_SELECTOR), function (element) {
      var itemTicker = cleanText(element.getAttribute("data-resource-ticker")).toUpperCase();
      var itemKind = cleanText(element.getAttribute("data-resource-kind"));
      var href = cleanText(element.getAttribute("data-resource-href"));
      var title = cleanText(element.getAttribute("data-resource-title")) || KIND_LABELS[kind];
      var key = href + "|" + title;
      if (itemTicker !== wantedTicker || itemKind !== kind || !href || seen[key]) {
        return;
      }

      seen[key] = true;
      items.push({
        href: href,
        title: title,
        meta: cleanText(element.getAttribute("data-resource-meta")) || wantedTicker
      });
    });

    return items;
  }

  function openPicker(ticker, kind) {
    var panel = ensurePanel();
    var list = panel.querySelector(".company-resource-list");
    var items = collectItems(ticker, kind);
    panel.querySelector(".company-resource-ticker").textContent = ticker;
    panel.querySelector(".company-resource-title").textContent = KIND_LABELS[kind] || "자료";
    list.innerHTML = "";

    items.forEach(function (item) {
      var link = document.createElement("a");
      var copy = document.createElement("div");
      var title = document.createElement("strong");
      var meta = document.createElement("span");
      var arrow = document.createElement("span");
      link.className = "company-resource-item";
      link.href = item.href;
      link.target = "_self";
      title.textContent = item.title;
      meta.textContent = item.meta;
      arrow.className = "company-resource-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "›";
      copy.appendChild(title);
      copy.appendChild(meta);
      link.appendChild(copy);
      link.appendChild(arrow);
      list.appendChild(link);
    });

    panel.hidden = false;
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    var trigger = target && target.closest ? target.closest(TRIGGER_SELECTOR) : null;
    if (!trigger) {
      return;
    }

    event.preventDefault();
    openPicker(trigger.getAttribute("data-resource-ticker"), trigger.getAttribute("data-resource-kind"));
  });
})();
