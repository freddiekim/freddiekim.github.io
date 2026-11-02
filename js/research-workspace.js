(function () {
  'use strict';
  var main = document.querySelector('[data-research-index]');
  if (!main) return;
  var portfolio = JSON.parse(document.getElementById('portfolio-data').textContent);
  var kinds = { analysis: '기업분석', earnings: '실적 요약', call: '어닝콜', qa: '질의응답', quarterly: '분기보고서', portfolio: '포트폴리오 기록' };
  var positions = portfolio.positions || [];
  var catalog = JSON.parse(document.getElementById('company-catalog').textContent);
  var names = {};
  catalog.forEach(function (company) { names[company.ticker.toUpperCase()] = company.name; });
  positions.forEach(function (position) { names[position.ticker.toUpperCase()] = position.name; });
  var documents = [];
  var limit = 20;
  var search = document.getElementById('research-search');
  var category = document.getElementById('research-category');
  var more = document.getElementById('load-more');
  var companyQuery = new URLSearchParams(window.location.search).get('company') || '';
  var normalize = function (value) { return String(value || '').toLocaleLowerCase().replace(/\s+/g, ' ').trim(); };
  function dateLabel(value) {
    return /^\d{8}$/.test(value) ? value.slice(0, 4) + '.' + value.slice(4, 6) + '.' + value.slice(6, 8) : '날짜 미표기';
  }
  function titleFor(item) {
    if (item.title) return item.title;
    if (item.kind === 'portfolio') return 'YOUNG FINANCE · 포트폴리오 기록';
    if (item.kind === 'quarterly') return 'YOUNG FINANCE · 분기보고서';
    var companyName = names[item.ticker.toUpperCase()] || item.ticker;
    var period = item.filename.match(/(20\d{2})[_-]?(Q[1-4])|(Q[1-4])[_-]?(20\d{2})/i);
    var quarter = period ? ((period[1] || period[4]) + ' ' + (period[2] || period[3]).toUpperCase() + ' · ') : '';
    return companyName + ' · ' + quarter + (kinds[item.kind] || '기업 자료');
  }
  function documentElement(item) {
    var li = document.createElement('li');
    var link = document.createElement('a');
    link.className = 'document-link';
    link.href = item.url;
    var copy = document.createElement('div');
    var meta = document.createElement('div');
    meta.className = 'document-meta';
    var ticker = document.createElement('span');
    ticker.className = 'document-ticker';
    ticker.textContent = item.ticker;
    var kind = document.createElement('span');
    kind.className = 'document-kind';
    kind.textContent = kinds[item.kind];
    var time = document.createElement('span');
    time.className = 'document-date';
    time.textContent = (item.kind === 'quarterly' ? '기준 ' : '') + dateLabel(item.date);
    var title = document.createElement('strong');
    title.className = 'document-title';
    title.textContent = titleFor(item);
    var arrow = document.createElement('i');
    arrow.className = 'fa fa-angle-right document-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    meta.append(ticker, kind, time);
    copy.append(meta, title);
    link.append(copy, arrow);
    li.append(link);
    return li;
  }
  function state(list, message) {
    list.replaceChildren();
    var li = document.createElement('li');
    li.className = 'list-state';
    li.textContent = message;
    list.append(li);
    return li;
  }
  function updateContext() {
    var box = document.getElementById('company-context');
    if (!box) return;
    box.replaceChildren();
    box.hidden = !companyQuery;
    if (!companyQuery) return;
    var companyName = names[companyQuery.toUpperCase()] || companyQuery;
    box.append(document.createTextNode(companyName + ' · ' + companyQuery));
    var company = catalog.find(function (entry) { return entry.ticker.toUpperCase() === companyQuery.toUpperCase(); });
    if (company) {
      var link = document.createElement('a');
      link.href = company.url;
      link.textContent = '기업 개요';
      box.append(link);
    }
  }
  function renderLibrary() {
    var list = document.getElementById('research-documents');
    if (!list) return;
    var query = normalize(search.value);
    var filtered = documents.filter(function (item) {
      var matchCompany = !companyQuery || normalize(item.ticker) === normalize(companyQuery);
      var matchKind = category.value === 'all' || category.value === item.kind;
      var text = normalize([item.ticker, names[item.ticker.toUpperCase()], item.filename, titleFor(item), kinds[item.kind]].join(' '));
      return matchCompany && matchKind && (!query || text.includes(query));
    });
    list.replaceChildren();
    filtered.slice(0, limit).forEach(function (item) { list.append(documentElement(item)); });
    if (!filtered.length) state(list, '일치하는 자료가 없습니다.');
    document.getElementById('library-total').textContent = filtered.length + '건 · 최신순';
    more.hidden = filtered.length <= limit;
    updateContext();
  }
  function renderLatest() {
    var list = document.getElementById('latest-documents');
    if (!list) return;
    list.replaceChildren();
    documents.slice(0, 6).forEach(function (item) { list.append(documentElement(item)); });
    if (!documents.length) state(list, '등록된 자료가 없습니다.');
  }
  function updateHoldingLinks() {
    document.querySelectorAll('[data-latest-for]').forEach(function (link) {
      var ticker = link.dataset.latestFor.toUpperCase();
      var item = documents.find(function (entry) { return entry.ticker.toUpperCase() === ticker && entry.kind === 'analysis'; });
      if (item) {
        link.href = item.url;
        link.textContent = item.date ? dateLabel(item.date) : '기업분석';
        link.title = titleFor(item);
      }
    });
  }
  function safeDocument(item) {
    return item && Object.hasOwn(kinds, item.kind) && typeof item.ticker === 'string' &&
      typeof item.filename === 'string' && typeof item.url === 'string' &&
      item.url.startsWith('/') && !item.url.startsWith('//');
  }
  async function loadDocuments() {
    try {
      var response = await fetch(main.dataset.researchIndex);
      if (!response.ok) throw new Error('Index unavailable');
      var payload = await response.json();
      if (!Array.isArray(payload)) throw new Error('Invalid document index');
      documents = payload.filter(safeDocument).map(function (item) {
        item.date = String(item.date || '');
        return item;
      }).sort(function (a, b) { return b.date.localeCompare(a.date) || a.ticker.localeCompare(b.ticker) || a.filename.localeCompare(b.filename); });
      renderLatest();
      renderLibrary();
      updateHoldingLinks();
    } catch (error) {
      ['latest-documents', 'research-documents'].forEach(function (id) {
        var list = document.getElementById(id);
        if (!list) return;
        var li = state(list, '자료 목록을 불러오지 못했습니다.');
        var retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'retry-button';
        retry.textContent = '다시 시도';
        retry.addEventListener('click', loadDocuments);
        li.append(retry);
      });
    }
  }
  var holdingSearch = document.getElementById('holding-search');
  if (holdingSearch) holdingSearch.addEventListener('input', function () {
    var query = normalize(holdingSearch.value);
    var count = 0;
    document.querySelectorAll('[data-holding-search]').forEach(function (row) {
      row.hidden = !normalize(row.dataset.holdingSearch).includes(query);
      if (!row.hidden) count += 1;
    });
    document.getElementById('holding-empty').hidden = count > 0;
  });
  if (search) {
    search.value = companyQuery ? '' : (new URLSearchParams(window.location.search).get('q') || '');
    var requestedCategory = new URLSearchParams(window.location.search).get('category');
    if (Object.hasOwn(kinds, requestedCategory)) category.value = requestedCategory;
    search.addEventListener('input', function () { limit = 20; renderLibrary(); });
    category.addEventListener('change', function () { limit = 20; renderLibrary(); });
    more.addEventListener('click', function () { limit += 20; renderLibrary(); });
    document.getElementById('clear-filters').addEventListener('click', function () {
      companyQuery = '';
      search.value = '';
      category.value = 'all';
      limit = 20;
      history.replaceState(null, '', window.location.pathname);
      renderLibrary();
      search.focus();
    });
  }
  loadDocuments();
})();
