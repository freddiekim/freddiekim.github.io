(function () {
  function fallbackTitleFromHref(href) {
    try {
      var path = new URL(href, window.location.href).pathname;
      var fileName = path.split("/").pop() || "";
      return decodeURIComponent(fileName.replace(/\.html$/i, "").replace(/[_-]+/g, " "));
    } catch (error) {
      return "";
    }
  }

  function extractTitle(html) {
    var match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match) {
      return "";
    }

    var textArea = document.createElement("textarea");
    textArea.innerHTML = match[1];
    return textArea.value.replace(/\s+/g, " ").trim();
  }

  function enhanceQnALinks() {
    var links = Array.prototype.slice.call(document.querySelectorAll('a[href*="/pages_QnA/"], a[href*="pages_QnA/"]'));
    var cache = {};

    links.forEach(function (link) {
      var href = link.getAttribute("href");
      if (!href || link.getAttribute("title")) {
        return;
      }

      var absoluteHref = new URL(href, window.location.href).href;
      if (!cache[absoluteHref]) {
        cache[absoluteHref] = fetch(absoluteHref)
          .then(function (response) {
            if (!response.ok) {
              throw new Error("Unable to load QnA title");
            }
            return response.text();
          })
          .then(function (html) {
            return extractTitle(html) || fallbackTitleFromHref(absoluteHref);
          })
          .catch(function () {
            return fallbackTitleFromHref(absoluteHref);
          });
      }

      cache[absoluteHref].then(function (title) {
        if (!title) {
          return;
        }
        link.setAttribute("title", title);
        link.setAttribute("aria-label", "QnA: " + title);
        link.setAttribute("data-file-title", title);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhanceQnALinks);
  } else {
    enhanceQnALinks();
  }
})();
