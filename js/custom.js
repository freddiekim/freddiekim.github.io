document.addEventListener("DOMContentLoaded", function () {
  var sidebar = document.getElementById("sidebar-wrapper");
  var menuToggle = document.getElementById("menu-toggle");
  var menuClose = document.getElementById("menu-close");

  function toggleSidebar(event) {
    if (event) {
      event.preventDefault();
    }
    if (sidebar) {
      sidebar.classList.toggle("active");
    }
  }

  function closeSidebar() {
    if (sidebar) {
      sidebar.classList.remove("active");
    }
  }

  if (menuToggle) {
    menuToggle.addEventListener("click", toggleSidebar);
  }

  if (menuClose) {
    menuClose.addEventListener("click", toggleSidebar);
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      var targetId = link.getAttribute("href");
      if (!targetId || targetId === "#") {
        return;
      }

      var target = document.querySelector(targetId);
      if (!target) {
        return;
      }

      event.preventDefault();
      closeSidebar();
      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });
});
