// BrickBot — Search Results Page

(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var query = params.get('q') || '';
  var currentCat = '';
  var currentPage = 1;
  var hasMore = false;
  var isLoading = false;

  // DOM refs
  var searchInput = document.getElementById('search-input');
  var searchHeading = document.getElementById('search-heading');
  var searchCount = document.getElementById('search-count');
  var searchGrid = document.getElementById('search-grid');
  var searchEmpty = document.getElementById('search-empty');
  var showMoreWrap = document.getElementById('search-show-more-wrap');
  var showMoreBtn = document.getElementById('search-show-more-btn');
  var searchForm = document.getElementById('search-hero-form');

  // Set initial input value
  if (query) {
    searchInput.value = query;
    document.title = 'BrickBot — "' + query + '"';
  }

  // Bench badge
  try {
    var pieces = JSON.parse(localStorage.getItem('brickbot_bench_pieces') || '[]');
    var badge = document.getElementById('bench-badge');
    if (badge && pieces.length > 0) {
      badge.textContent = pieces.length;
      badge.style.display = 'inline-block';
    }
  } catch (e) {}

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function doSearch(append) {
    if (isLoading) return;
    isLoading = true;

    if (!append) {
      searchGrid.innerHTML = '<div class="search-loading-msg">BrickBot is searching...</div>';
      searchEmpty.style.display = 'none';
      showMoreWrap.style.display = 'none';
      searchHeading.textContent = 'Results for "' + query + '"';
      searchCount.textContent = '';
    } else {
      showMoreBtn.textContent = 'Loading...';
      showMoreBtn.disabled = true;
    }

    var url = '/api/search-parts?q=' + encodeURIComponent(query) + '&page=' + currentPage;
    if (currentCat) url += '&cat=' + encodeURIComponent(currentCat);

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('Search failed');
        return res.json();
      })
      .then(function (data) {
        var results = data.results || [];
        hasMore = !!data.next;

        if (!append) {
          searchGrid.innerHTML = '';
        }

        if (results.length === 0 && !append) {
          searchEmpty.style.display = 'block';
          searchCount.textContent = '0 results';
          showMoreWrap.style.display = 'none';
          isLoading = false;
          return;
        }

        searchEmpty.style.display = 'none';
        searchCount.textContent = data.count + ' result' + (data.count === 1 ? '' : 's') + ' found';

        results.forEach(function (part) {
          var card = document.createElement('a');
          card.className = 'search-result-card';
          card.href = 'part.html?part=' + encodeURIComponent(part.part_num);
          card.innerHTML =
            '<img src="' + (part.part_img_url || '') + '" alt="' + escapeHtml(part.name) + '" class="search-result-img" onerror="this.style.background=\'#eee\'">' +
            '<div class="search-result-name">' + escapeHtml(part.name) + '</div>' +
            '<div class="search-result-num">#' + escapeHtml(part.part_num) + '</div>';
          searchGrid.appendChild(card);
        });

        if (hasMore) {
          showMoreWrap.style.display = 'block';
          showMoreBtn.textContent = 'Show more \u2192';
          showMoreBtn.disabled = false;
        } else {
          showMoreWrap.style.display = 'none';
        }

        isLoading = false;
      })
      .catch(function () {
        if (!append) {
          searchGrid.innerHTML = '';
          searchEmpty.style.display = 'block';
          searchCount.textContent = 'Search failed — try again';
        }
        showMoreBtn.textContent = 'Show more \u2192';
        showMoreBtn.disabled = false;
        isLoading = false;
      });
  }

  // Show more button
  showMoreBtn.addEventListener('click', function () {
    currentPage++;
    doSearch(true);
  });

  // Category filters
  document.querySelectorAll('#search-filters .search-cat-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#search-filters .search-cat-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      currentCat = btn.getAttribute('data-cat');
      currentPage = 1;
      doSearch(false);
    });
  });

  // Re-search from the form
  searchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var newQuery = searchInput.value.trim();
    if (!newQuery) return;

    // Pure number → part page
    if (/^\d+[a-z]?$/.test(newQuery)) {
      window.location.href = 'part.html?part=' + encodeURIComponent(newQuery);
      return;
    }

    query = newQuery;
    currentPage = 1;
    document.title = 'BrickBot — "' + query + '"';
    // Update URL without reload
    history.replaceState(null, '', 'search.html?q=' + encodeURIComponent(query));
    doSearch(false);
  });

  // Initial search on load
  if (query) {
    doSearch(false);
  } else {
    searchHeading.textContent = 'Search for a LEGO piece';
    searchCount.textContent = 'Type a description or part number above';
  }

})();
