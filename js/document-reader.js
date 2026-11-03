(function () {
  'use strict';
  document.documentElement.classList.add('document-reader');
  if (document.querySelector('.site-topbar')) document.body.classList.add('reader-workspace');
  var mobile = window.matchMedia('(max-width: 760px)');
  var isReport = /\/(pages_html|pages_QnA|pages_Q_earnings|pages_conferenceCall|pages_Quarter&Annual|pages_portfolio)\//.test(location.pathname);

  if (isReport && !document.querySelector('.reader-nav')) {
    var nav = document.createElement('nav');
    nav.className = 'reader-nav';
    nav.setAttribute('aria-label', '자료 탐색');
    [['/', 'YOUNG FINANCE'], ['/pages/research.html', '자료실'], ['/pages/portfolio.html', '현재 포트폴리오']].forEach(function (item) {
      var link = document.createElement('a');
      link.href = item[0]; link.textContent = item[1]; nav.appendChild(link);
    });
    document.body.prepend(nav);
  }

  function scrollRegion(node, className, label) {
    var wrap = document.createElement('div');
    wrap.className = className;
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', label);
    node.before(wrap); wrap.appendChild(node);
    return wrap;
  }

  document.querySelectorAll('table').forEach(function (table, index) {
    if (table.closest('.reader-workspace')) return;
    if (table.closest('.reader-table') || table.querySelector('table')) return;
    var rows = Array.from(table.rows);
    var head = rows[0];
    if (!head) return;
    var columns = Math.max.apply(null, rows.map(function (row) { return Array.from(row.cells).reduce(function (n, cell) { return n + cell.colSpan; }, 0); }));
    var headers = Array.from(head.cells).map(function (cell) { return cell.textContent.trim(); });
    var cells = rows.slice(1).flatMap(function (row) { return Array.from(row.cells); });
    var narrative = columns >= 4 && cells.some(function (cell) { return cell.textContent.trim().length > 45; });
    var regular = rows.slice(1).every(function (row) { return row.cells.length === headers.length && Array.from(row.cells).every(function (cell) { return cell.colSpan === 1 && cell.rowSpan === 1; }); });
    var stack = narrative && regular && head.querySelector('th') && !table.closest('.reader-workspace');
    var wrap = scrollRegion(table, 'reader-table', '표 ' + (index + 1));
    if (stack) {
      table.classList.add('reader-stack'); wrap.classList.add('reader-stack-wrap');
      rows.slice(1).forEach(function (row) {
        Array.from(row.cells).forEach(function (cell, i) { if (i > 0 && headers[i]) cell.dataset.readerLabel = headers[i]; });
      });
    } else if (columns > 3) {
      table.classList.add('reader-wide-table');
      wrap.style.setProperty('--reader-table-width', Math.max(480, columns * 100) + 'px');
      var hint = document.createElement('p'); hint.className = 'reader-hint'; hint.textContent = '표를 좌우로 넘겨 전체 항목을 볼 수 있습니다.'; wrap.before(hint);
    }
  });

  document.querySelectorAll('svg[viewBox]').forEach(function (svg) {
    if (svg.closest('.reader-chart') || !svg.querySelector('text')) return;
    var width = Number(svg.getAttribute('viewBox').split(/[\s,]+/)[2]);
    if (!(width > 500)) return;
    var wrap = scrollRegion(svg, 'reader-chart', svg.getAttribute('aria-label') || '차트, 좌우로 넘겨 보기');
    wrap.style.setProperty('--reader-chart-width', Math.max(600, Math.min(width, 1000)) + 'px');
    var hint = document.createElement('p'); hint.className = 'reader-hint'; hint.textContent = '차트를 좌우로 넘겨 상세 수치를 확인하세요.'; wrap.before(hint);
  });

  if (!document.body.classList.contains('reader-workspace')) {
    document.querySelectorAll('main div, main section, .wrap > div, .container > div, .page > div, .detail-shell > section').forEach(function (node) {
      if (getComputedStyle(node).display !== 'grid' || node.closest('.reader-table, .reader-chart')) return;
      node.classList.add('reader-grid');
      if (Array.from(node.children).every(function (child) { return child.matches('.kpi, .metric, .stat, .pf-kpis > div'); })) node.classList.add('reader-kpis');
    });
    document.querySelectorAll('aside, .toc, .sidebar, .side-nav').forEach(function (node) {
      if (['fixed', 'sticky'].includes(getComputedStyle(node).position)) node.classList.add('reader-fixed-nav');
      if (!node.querySelectorAll('a[href^="#"]').length || node.closest('.reader-toc')) return;
      var details = document.createElement('details'); details.className = 'reader-toc'; details.open = !mobile.matches;
      var summary = document.createElement('summary'); summary.textContent = '문서 목차';
      node.before(details); details.append(summary, node);
      node.querySelectorAll('a').forEach(function (link) { link.addEventListener('click', function () { if (mobile.matches) details.open = false; }); });
      mobile.addEventListener('change', function (event) { details.open = !event.matches; });
    });
  }
}());
