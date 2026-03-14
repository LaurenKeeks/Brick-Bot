// BrickBot — Main App Logic (Phase 1: No API calls)

(function () {
  'use strict';

  // --- Search form ---
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('part-search');

  if (searchForm) {
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const partNum = searchInput.value.trim();
      if (partNum) {
        window.location.href = 'part.html?part=' + encodeURIComponent(partNum);
      }
    });
  }

  // --- Example chips ---
  const chips = document.querySelectorAll('.chip[data-part]');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      const partNum = chip.getAttribute('data-part');
      window.location.href = 'part.html?part=' + encodeURIComponent(partNum);
    });
  });

  // --- Camera button ---
  const cameraBtn = document.getElementById('camera-btn');
  if (cameraBtn) {
    cameraBtn.addEventListener('click', function () {
      window.location.href = 'mystery.html';
    });
  }

  // --- Recent lookups from localStorage ---
  function renderRecentLookups() {
    const grid = document.getElementById('recent-grid');
    const emptyMsg = document.getElementById('recent-empty');
    if (!grid) return;

    const recent = JSON.parse(localStorage.getItem('brickbot_recent') || '[]');
    const toShow = recent.slice(0, 6);

    if (toShow.length === 0) {
      grid.style.display = 'none';
      if (emptyMsg) emptyMsg.style.display = 'block';
      return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';
    grid.style.display = 'grid';
    grid.innerHTML = '';

    toShow.forEach(function (item) {
      var card = document.createElement('a');
      card.className = 'recent-card';
      card.href = 'part.html?part=' + encodeURIComponent(item.partNum);

      var img = document.createElement('img');
      img.className = 'recent-card-img';
      img.src = item.imgUrl || '';
      img.alt = item.name || item.partNum;
      img.onerror = function () { this.style.display = 'none'; };

      var name = document.createElement('div');
      name.className = 'recent-card-name';
      name.textContent = item.name || 'Part';

      var num = document.createElement('div');
      num.className = 'recent-card-num';
      num.textContent = '#' + item.partNum;

      card.appendChild(img);
      card.appendChild(name);
      card.appendChild(num);
      grid.appendChild(card);
    });
  }

  renderRecentLookups();
})();
