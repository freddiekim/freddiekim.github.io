(function () {
  var STORAGE_KEY = "youngFinanceInvestmentDiaryEntries";
  var toastTimer = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function todayString() {
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, "0");
    var day = String(now.getDate()).padStart(2, "0");
    return [year, month, day].join("-");
  }

  function makeId() {
    return "diary-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function readEntries() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeEntries(entries) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function showToast(message) {
    var toast = byId("diary-toast");
    if (!toast) {
      return;
    }

    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2200);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cleanTicker(value) {
    return String(value || "").trim().toUpperCase();
  }

  function entryMatches(entry) {
    var search = String(byId("diary-search").value || "").trim().toLowerCase();
    var action = byId("diary-action-filter").value;
    var role = byId("diary-role-filter").value;
    var haystack = [
      entry.title,
      entry.ticker,
      entry.action,
      entry.conviction,
      entry.mood,
      entry.role,
      entry.body
    ].join(" ").toLowerCase();

    if (action && entry.action !== action) {
      return false;
    }

    if (role && entry.role !== role) {
      return false;
    }

    return !search || haystack.indexOf(search) !== -1;
  }

  function updateStats(entries) {
    var currentMonth = todayString().slice(0, 7);
    var tickerCounts = {};
    var topTicker = "-";
    var topCount = 0;
    var sorted = entries.slice().sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });

    entries.forEach(function (entry) {
      if (!entry.ticker) {
        return;
      }

      tickerCounts[entry.ticker] = (tickerCounts[entry.ticker] || 0) + 1;
      if (tickerCounts[entry.ticker] > topCount) {
        topTicker = entry.ticker;
        topCount = tickerCounts[entry.ticker];
      }
    });

    byId("diary-total-count").textContent = String(entries.length);
    byId("diary-month-count").textContent = String(entries.filter(function (entry) {
      return String(entry.date || "").slice(0, 7) === currentMonth;
    }).length);
    byId("diary-last-date").textContent = sorted[0] && sorted[0].date ? sorted[0].date.slice(5).replace("-", ".") : "-";
    byId("diary-top-ticker").textContent = topTicker;
  }

  function renderEntries() {
    var container = byId("diary-entries");
    var entries = readEntries().sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || "")) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
    var filtered = entries.filter(entryMatches);

    updateStats(entries);

    if (!filtered.length) {
      container.innerHTML = '<div class="diary-empty">아직 표시할 투자일기가 없습니다.</div>';
      return;
    }

    container.innerHTML = filtered.map(function (entry) {
      var ticker = entry.ticker ? '<span class="diary-tag diary-tag-ticker">' + escapeHtml(entry.ticker) + "</span>" : "";
      var role = entry.role ? '<span class="diary-tag diary-tag-action">' + escapeHtml(entry.role) + "</span>" : "";
      var action = entry.action ? '<span class="diary-tag diary-tag-action">' + escapeHtml(entry.action) + "</span>" : "";
      var conviction = entry.conviction ? '<span class="diary-tag diary-tag-conviction">' + escapeHtml(entry.conviction) + "</span>" : "";
      var mood = entry.mood ? '<span class="diary-tag diary-tag-mood">' + escapeHtml(entry.mood) + "</span>" : "";

      return [
        '<article class="diary-entry" data-entry-id="' + escapeHtml(entry.id) + '">',
        '  <div class="diary-entry-top">',
        '    <div class="diary-entry-title">',
        "      <h3>" + escapeHtml(entry.title) + "</h3>",
        '      <div class="diary-tags">' + ticker + role + action + conviction + mood + "</div>",
        "    </div>",
        '    <span class="diary-entry-date">' + escapeHtml(entry.date || "") + "</span>",
        "  </div>",
        '  <div class="diary-entry-body">' + escapeHtml(entry.body) + "</div>",
        '  <footer class="diary-entry-footer">',
        '    <div class="diary-entry-actions">',
        '      <button class="diary-button diary-button-blue" type="button" data-diary-edit="' + escapeHtml(entry.id) + '"><i class="fa fa-pencil" aria-hidden="true"></i> Edit</button>',
        '      <button class="diary-button diary-button-red" type="button" data-diary-delete="' + escapeHtml(entry.id) + '"><i class="fa fa-trash-o" aria-hidden="true"></i> Delete</button>',
        "    </div>",
        "  </footer>",
        "</article>"
      ].join("");
    }).join("");
  }

  function resetForm() {
    byId("diary-entry-id").value = "";
    byId("investment-diary-form").reset();
    byId("diary-date").value = todayString();
    byId("diary-title").focus();
  }

  function saveFromForm(event) {
    event.preventDefault();

    var entries = readEntries();
    var id = byId("diary-entry-id").value || makeId();
    var existingIndex = entries.findIndex(function (entry) {
      return entry.id === id;
    });
    var now = new Date().toISOString();
    var entry = {
      id: id,
      date: byId("diary-date").value || todayString(),
      ticker: cleanTicker(byId("diary-ticker").value),
      title: byId("diary-title").value.trim(),
      action: byId("diary-action").value,
      conviction: byId("diary-conviction").value,
      mood: byId("diary-mood").value,
      role: byId("diary-role").value,
      body: byId("diary-body").value.trim(),
      createdAt: existingIndex >= 0 ? entries[existingIndex].createdAt : now,
      updatedAt: now
    };

    if (!entry.title || !entry.body) {
      showToast("제목과 본문을 입력해 주세요.");
      return;
    }

    if (existingIndex >= 0) {
      entries[existingIndex] = entry;
    } else {
      entries.push(entry);
    }

    writeEntries(entries);
    resetForm();
    renderEntries();
    showToast("투자일기를 저장했습니다.");
  }

  function editEntry(id) {
    var entry = readEntries().find(function (item) {
      return item.id === id;
    });

    if (!entry) {
      return;
    }

    byId("diary-entry-id").value = entry.id;
    byId("diary-date").value = entry.date || todayString();
    byId("diary-ticker").value = entry.ticker || "";
    byId("diary-title").value = entry.title || "";
    byId("diary-action").value = entry.action || "관찰";
    byId("diary-conviction").value = entry.conviction || "중립";
    byId("diary-mood").value = entry.mood || "침착";
    byId("diary-role").value = entry.role || "주전";
    byId("diary-body").value = entry.body || "";
    byId("diary-title").focus();
    showToast("수정할 일기를 불러왔습니다.");
  }

  function deleteEntry(id) {
    var entries = readEntries();
    var entry = entries.find(function (item) {
      return item.id === id;
    });

    if (!entry || !window.confirm("이 투자일기를 삭제할까요?")) {
      return;
    }

    writeEntries(entries.filter(function (item) {
      return item.id !== id;
    }));
    renderEntries();
    showToast("투자일기를 삭제했습니다.");
  }

  function exportEntries() {
    var entries = readEntries();
    var blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");

    link.href = url;
    link.download = "young-finance-investment-diary-" + todayString().replace(/-/g, "") + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("백업 파일을 만들었습니다.");
  }

  function importEntries(file) {
    var reader = new FileReader();

    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || "[]"));
        var entries = readEntries();
        var entriesById = {};

        if (!Array.isArray(parsed)) {
          throw new Error("Invalid diary backup");
        }

        entries.concat(parsed).filter(function (entry) {
          return entry && entry.id && entry.title && entry.body;
        }).forEach(function (entry) {
          entriesById[entry.id] = entry;
        });

        writeEntries(Object.keys(entriesById).map(function (id) {
          return entriesById[id];
        }));
        renderEntries();
        showToast("백업을 불러왔습니다.");
      } catch (error) {
        showToast("백업 파일을 읽지 못했습니다.");
      }
    };

    reader.readAsText(file);
  }

  function bindEvents() {
    byId("investment-diary-form").addEventListener("submit", saveFromForm);
    byId("investment-diary-form").addEventListener("reset", function () {
      window.setTimeout(function () {
        byId("diary-entry-id").value = "";
        byId("diary-date").value = todayString();
      }, 0);
    });
    byId("diary-new-button").addEventListener("click", resetForm);
    byId("diary-export-button").addEventListener("click", exportEntries);
    byId("diary-import-button").addEventListener("click", function () {
      byId("diary-import-file").click();
    });
    byId("diary-import-file").addEventListener("change", function (event) {
      var file = event.target.files && event.target.files[0];
      if (file) {
        importEntries(file);
      }
      event.target.value = "";
    });
    byId("diary-search").addEventListener("input", renderEntries);
    byId("diary-action-filter").addEventListener("change", renderEntries);
    byId("diary-role-filter").addEventListener("change", renderEntries);
    byId("diary-entries").addEventListener("click", function (event) {
      var editButton = event.target.closest("[data-diary-edit]");
      var deleteButton = event.target.closest("[data-diary-delete]");

      if (editButton) {
        editEntry(editButton.getAttribute("data-diary-edit"));
      }

      if (deleteButton) {
        deleteEntry(deleteButton.getAttribute("data-diary-delete"));
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    byId("diary-date").value = todayString();
    bindEvents();
    renderEntries();
  });
})();
