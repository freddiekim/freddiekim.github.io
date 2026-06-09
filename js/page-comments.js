(function () {
  var script = document.currentScript;
  var shortname = (script && script.getAttribute("data-disqus-shortname")) || "freddiekim";
  var siteUrl = (script && script.getAttribute("data-site-url")) || "https://freddiekim.github.io";
  var path = window.location.pathname || "/";

  path = path.replace(/\/index\.html$/, "/");

  if (document.getElementById("disqus_thread")) {
    return;
  }

  if (!document.querySelector('link[href="/css/page-comments.css"]')) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/css/page-comments.css";
    document.head.appendChild(link);
  }

  var section = document.createElement("section");
  section.className = "comments-section page-comments-section";
  section.id = "comments";
  section.setAttribute("data-disqus-identifier", path);
  section.setAttribute("data-disqus-url", siteUrl + path);
  section.innerHTML = [
    '<div class="comments-container">',
    '  <div class="comments-heading">',
    '    <p>Comments</p>',
    "    <h2>Discussion</h2>",
    "  </div>",
    '  <div class="disqus" id="disqus_thread"></div>',
    "  <noscript>Please enable JavaScript to view the comments powered by Disqus.</noscript>",
    "</div>"
  ].join("");

  if (script && script.parentNode) {
    script.parentNode.insertBefore(section, script);
  } else {
    document.body.appendChild(section);
  }

  window.disqus_config = function () {
    this.page.url = siteUrl + path;
    this.page.identifier = path;
  };

  var embed = document.createElement("script");
  embed.src = "https://" + shortname + ".disqus.com/embed.js";
  embed.setAttribute("data-timestamp", String(Date.now()));
  (document.head || document.body).appendChild(embed);
})();
