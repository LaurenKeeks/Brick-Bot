// BrickBot — Brick Bench Logic

(function () {
  'use strict';

  var MAX_PIECES = 30;
  var STORAGE_KEY = 'brickbot_bench_pieces';

  // --- State ---
  var benchState = {
    pieces: [],
    ageGroup: 'Ages 9-12',
    topics: [],
    results: null,
    challenge: null
  };

  // --- DOM refs ---
  var grid = document.getElementById('bench-grid');
  var countPill = document.getElementById('bench-count-pill');
  var clearBtn = document.getElementById('bench-clear-btn');
  var searchInput = document.getElementById('piece-search-input');
  var searchResultsArea = document.getElementById('search-results-area');
  var searchResultsGrid = document.getElementById('search-results-grid');
  var searchResultsLabel = document.getElementById('search-results-label');
  var searchNoResults = document.getElementById('search-no-results');
  var photoBtn = document.getElementById('photo-search-btn');
  var photoFileInput = document.getElementById('photo-file-input');
  var ghostCard = document.getElementById('bench-ghost-card');
  var actionsSection = document.getElementById('bench-actions');
  var resultsSection = document.getElementById('bench-results');

  // --- localStorage ---
  function saveToLocalStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(benchState.pieces));
    } catch (e) {
      // silently fail
    }
  }

  function loadFromLocalStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var pieces = JSON.parse(raw);
      if (Array.isArray(pieces) && pieces.length > 0) {
        benchState.pieces = pieces;
        return true;
      }
    } catch (e) {
      // silently fail
    }
    return false;
  }

  // --- Toast ---
  function showToast(message) {
    var existing = document.querySelector('.bench-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'bench-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('visible');
    });

    setTimeout(function () {
      toast.classList.remove('visible');
      setTimeout(function () { toast.remove(); }, 300);
    }, 2500);
  }

  // --- Render ---
  function renderPieceGrid() {
    // Clear all piece cards (keep ghost)
    var existingCards = grid.querySelectorAll('.bench-piece-card:not(.bench-piece-ghost)');
    existingCards.forEach(function (card) { card.remove(); });

    // Remove empty state if present
    var emptyState = grid.querySelector('.bench-empty');
    if (emptyState) emptyState.remove();

    if (benchState.pieces.length === 0) {
      // Show empty state before ghost card
      var empty = document.createElement('div');
      empty.className = 'bench-empty';
      empty.style.gridColumn = '1 / -1';
      empty.innerHTML =
        '<div class="bench-empty-icon">🤖</div>' +
        '<p class="bench-empty-text">Your bench is empty! Add some pieces above to get started.</p>' +
        '<div class="bench-empty-arrow">&#8593;</div>';
      grid.insertBefore(empty, ghostCard);
    } else {
      benchState.pieces.forEach(function (piece) {
        var card = document.createElement('div');
        card.className = 'bench-piece-card';
        card.setAttribute('data-part', piece.part_num);

        var removeBtn = document.createElement('button');
        removeBtn.className = 'bench-piece-remove';
        removeBtn.title = 'Remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', function () {
          removePiece(piece.part_num);
        });

        var img = document.createElement('img');
        img.className = 'bench-piece-img';
        img.src = piece.part_img_url || '';
        img.alt = piece.name || piece.part_num;
        img.onerror = function () { this.style.display = 'none'; };

        var name = document.createElement('div');
        name.className = 'bench-piece-name';
        name.textContent = piece.name || 'Unknown';

        var num = document.createElement('div');
        num.className = 'bench-piece-num';
        num.textContent = '#' + piece.part_num;

        card.appendChild(removeBtn);
        card.appendChild(img);
        card.appendChild(name);
        card.appendChild(num);

        grid.insertBefore(card, ghostCard);
      });
    }

    // Update count pill
    var count = benchState.pieces.length;
    countPill.textContent = count + (count === 1 ? ' piece' : ' pieces');

    // Show/hide actions
    actionsSection.style.display = count >= 2 ? 'block' : 'none';
  }

  // --- Add/Remove pieces ---
  function addPiece(partData) {
    // Check max
    if (benchState.pieces.length >= MAX_PIECES) {
      showToast('Bench is full! Max ' + MAX_PIECES + ' pieces.');
      return false;
    }
    // Check duplicate
    var isDuplicate = benchState.pieces.some(function (p) {
      return p.part_num === partData.part_num;
    });
    if (isDuplicate) return false;

    benchState.pieces.push(partData);
    saveToLocalStorage();
    renderPieceGrid();
    return true;
  }

  function removePiece(partNumber) {
    benchState.pieces = benchState.pieces.filter(function (p) {
      return p.part_num !== partNumber;
    });
    saveToLocalStorage();
    renderPieceGrid();
  }

  // --- Smart Search ---
  var searchDebounceTimer = null;

  function handleSearchInput() {
    clearTimeout(searchDebounceTimer);
    var query = searchInput.value.trim();

    if (!query) {
      searchResultsArea.style.display = 'none';
      return;
    }

    searchDebounceTimer = setTimeout(function () {
      // Pure number → direct part lookup
      if (/^\d+$/.test(query)) {
        searchResultsGrid.innerHTML = '<div class="search-loading">BrickBot is searching...</div>';
        searchNoResults.style.display = 'none';
        searchResultsLabel.textContent = 'Looking up part #' + query + '...';
        searchResultsArea.style.display = 'block';

        BrickBotAPI.getPart(query).then(function (part) {
          renderSearchResults([part], query);
        }).catch(function () {
          searchResultsGrid.innerHTML = '';
          searchNoResults.style.display = 'block';
          searchResultsLabel.textContent = 'No results for "' + query + '"';
        });
      } else {
        searchParts(query);
      }
    }, 400);
  }

  function searchParts(query) {
    searchResultsGrid.innerHTML = '<div class="search-loading">BrickBot is searching...</div>';
    searchNoResults.style.display = 'none';
    searchResultsLabel.textContent = 'Searching for "' + query + '"...';
    searchResultsArea.style.display = 'block';

    fetch('/api/search-parts?q=' + encodeURIComponent(query))
      .then(function (res) {
        if (!res.ok) throw new Error('Search failed');
        return res.json();
      })
      .then(function (data) {
        var results = data.results || [];
        renderSearchResults(results, query);
      })
      .catch(function () {
        searchResultsGrid.innerHTML = '';
        searchNoResults.style.display = 'block';
        searchResultsLabel.textContent = 'Search failed — try again';
      });
  }

  function renderSearchResults(results, query) {
    searchResultsGrid.innerHTML = '';

    if (results.length === 0) {
      searchNoResults.style.display = 'block';
      searchResultsLabel.textContent = 'No results for "' + query + '"';
      return;
    }

    searchNoResults.style.display = 'none';
    searchResultsLabel.textContent = 'Showing results for "' + query + '" \u2014 tap a piece to add it';

    results.forEach(function (part) {
      var card = document.createElement('div');
      card.className = 'search-result-card';

      var alreadyOnBench = benchState.pieces.some(function (p) { return p.part_num === part.part_num; });

      card.innerHTML =
        '<img src="' + (part.part_img_url || '') + '" alt="' + BrickBotUI.escapeHtml(part.name) + '" class="search-result-img" onerror="this.style.background=\'#eee\'">' +
        '<div class="search-result-name">' + BrickBotUI.escapeHtml(part.name) + '</div>' +
        '<div class="search-result-num">#' + BrickBotUI.escapeHtml(part.part_num) + '</div>' +
        '<button class="btn-add-result' + (alreadyOnBench ? ' added' : '') + '" ' +
          (alreadyOnBench ? 'disabled' : '') + '>' +
          (alreadyOnBench ? '\u2713 Added' : '+ Add') +
        '</button>';

      if (!alreadyOnBench) {
        card.querySelector('.btn-add-result').addEventListener('click', function () {
          addFromSearch(part, this);
        });
      }

      searchResultsGrid.appendChild(card);
    });
  }

  function addFromSearch(partData, btnEl) {
    var isDuplicate = benchState.pieces.some(function (p) { return p.part_num === partData.part_num; });
    if (isDuplicate) {
      showToast('That piece is already on your bench!');
      return;
    }

    if (addPiece(partData)) {
      btnEl.textContent = '\u2713 Added';
      btnEl.classList.add('added');
      btnEl.disabled = true;
      showToast('Added ' + partData.name + ' to your bench!');
    }
  }

  // --- Photo search ---
  function handlePhotoSearchBtn() {
    photoFileInput.click();
  }

  photoFileInput.addEventListener('change', function () {
    var file = photoFileInput.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = reader.result;
      var base64 = dataUrl.split(',')[1];
      var mediaType = file.type || 'image/jpeg';

      searchResultsGrid.innerHTML = '<div class="search-loading">BrickBot is looking at your photo...</div>';
      searchNoResults.style.display = 'none';
      searchResultsLabel.textContent = 'Identifying piece from photo...';
      searchResultsArea.style.display = 'block';
      searchInput.value = '';

      fetch('/api/identify-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: mediaType })
      }).then(function (res) {
        if (!res.ok) throw new Error('Photo ID failed');
        return res.json();
      }).then(function (data) {
        if (data.error) {
          searchResultsGrid.innerHTML = '';
          searchNoResults.style.display = 'block';
          searchResultsLabel.textContent = 'Could not identify piece';
          return;
        }

        // Fetch the identified part(s) from Rebrickable
        var partNums = [data.partNumber];
        if (data.alternatives) {
          data.alternatives.forEach(function (alt) {
            if (alt.partNumber) partNums.push(alt.partNumber);
          });
        }

        Promise.all(partNums.map(function (num) {
          return BrickBotAPI.getPart(num).catch(function () { return null; });
        })).then(function (parts) {
          var validParts = parts.filter(Boolean);
          renderSearchResults(validParts, 'photo');
          searchResultsLabel.textContent = 'BrickBot identified ' + validParts.length + ' possible match' + (validParts.length === 1 ? '' : 'es') + ' \u2014 tap to add';
        });
      }).catch(function () {
        searchResultsGrid.innerHTML = '';
        searchNoResults.style.display = 'block';
        searchResultsLabel.textContent = 'Photo identification failed — try again';
      });
    };
    reader.readAsDataURL(file);
    // Reset so same file can be re-selected
    photoFileInput.value = '';
  });

  // --- Clear bench ---
  function clearBench() {
    if (!confirm('Clear your whole bench? This can\u2019t be undone.')) return;
    benchState.pieces = [];
    benchState.results = null;
    benchState.challenge = null;
    saveToLocalStorage();
    renderPieceGrid();
    resultsSection.style.display = 'none';
    resultsSection.innerHTML = '';
    showToast('Bench cleared!');
  }

  // --- Age/Topic selectors ---
  function initFilters() {
    var ageBtns = document.querySelectorAll('#bench-age-btns .age-btn');
    ageBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        ageBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        benchState.ageGroup = btn.getAttribute('data-age');
      });
    });

    var topicChips = document.querySelectorAll('#bench-topic-chips .topic-chip');
    topicChips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var topic = chip.getAttribute('data-topic');
        chip.classList.toggle('active');
        if (chip.classList.contains('active')) {
          benchState.topics.push(topic);
        } else {
          benchState.topics = benchState.topics.filter(function (t) { return t !== topic; });
        }
      });
    });
  }

  // --- Build Ideas ---
  var buildBtn = document.getElementById('bench-build-btn');
  var challengeBtn = document.getElementById('bench-challenge-btn');

  function preparePiecesPayload() {
    return benchState.pieces.map(function (p) {
      return { partName: p.name, partNumber: p.part_num, category: '' };
    });
  }

  function renderBenchIdeas(ideas) {
    var html = '<div class="bench-results-inner">';
    ideas.forEach(function (idea, i) {
      var badgeColor = BrickBotUI.difficultyColor(idea.difficulty);
      html += '<div class="bench-idea-card">';

      // 1. Header + difficulty badge
      html += '  <div class="bench-idea-header">';
      html += '    <span class="bench-idea-label">BRICKBOT BUILD IDEA #' + (i + 1) + '</span>';
      html += '    <span class="bench-idea-difficulty" style="background:' + badgeColor + ';">' + BrickBotUI.escapeHtml(idea.difficulty) + '</span>';
      html += '  </div>';

      // 2. Name
      html += '  <h3 class="bench-idea-name">' + BrickBotUI.escapeHtml(idea.name) + '</h3>';

      // 3. Description
      html += '  <p class="bench-idea-desc">' + BrickBotUI.escapeHtml(idea.description) + '</p>';

      // 4. Piece image strip
      if (idea.piecesUsed && idea.piecesUsed.length > 0) {
        html += '  <div class="idea-pieces-strip">';
        html += '    <span class="idea-pieces-label">PIECES YOU\'LL USE</span>';
        html += '    <div class="idea-pieces-chips">';
        idea.piecesUsed.forEach(function (num) {
          var piece = benchState.pieces.find(function (p) { return p.part_num === num; });
          if (piece) {
            html += '<div class="idea-piece-chip">';
            html += '  <img src="' + (piece.part_img_url || '') + '" alt="' + BrickBotUI.escapeHtml(piece.name) + '" class="idea-piece-img" onerror="this.style.background=\'#eee\'">';
            html += '  <span class="idea-piece-label">' + BrickBotUI.escapeHtml(piece.name) + '</span>';
            html += '</div>';
          }
        });
        html += '    </div>';
        html += '  </div>';
      }

      // 5. Steps list
      if (idea.steps && idea.steps.length > 0) {
        html += '  <div class="idea-steps">';
        html += '    <span class="idea-steps-label">HOW TO BUILD IT</span>';
        html += '    <ol class="idea-steps-list">';
        idea.steps.forEach(function (step) {
          html += '      <li>' + BrickBotUI.escapeHtml(step) + '</li>';
        });
        html += '    </ol>';
        html += '  </div>';
      }

      // 6. Part number tags
      if (idea.piecesUsed && idea.piecesUsed.length > 0) {
        html += '  <div class="bench-idea-pieces">';
        idea.piecesUsed.forEach(function (num) {
          html += '<span class="bench-idea-piece-tag">#' + BrickBotUI.escapeHtml(num) + '</span>';
        });
        html += '  </div>';
      }

      // 7. View full build link
      var ideaSlug = idea.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
      var piecesParam = (idea.piecesUsed || []).join(',');
      var topicsParam = encodeURIComponent(benchState.topics.join(','));
      var ageParam = encodeURIComponent(benchState.ageGroup);
      var ideaURL = '/idea.html?name=' + ideaSlug + '&pieces=' + piecesParam + '&age=' + ageParam + '&topics=' + topicsParam;
      html += '<a href="' + ideaURL + '" class="btn-view-idea">View full build \u2192</a>';

      html += '</div>';
    });
    html += '</div>';
    resultsSection.innerHTML = html;
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderChallenge(challenge) {
    var html = '<div class="bench-results-inner">';
    html += '<div class="bench-challenge-card">';
    html += '  <div class="bench-challenge-label">BRICKBOT CHALLENGE</div>';
    html += '  <h3 class="bench-challenge-title">' + BrickBotUI.escapeHtml(challenge.title) + '</h3>';
    html += '  <p class="bench-challenge-desc">' + BrickBotUI.escapeHtml(challenge.description) + '</p>';
    if (challenge.piecesUsed && challenge.piecesUsed.length > 0) {
      html += '  <div class="bench-challenge-pieces">';
      challenge.piecesUsed.forEach(function (num) {
        html += '<span class="bench-idea-piece-tag">#' + BrickBotUI.escapeHtml(num) + '</span>';
      });
      html += '  </div>';
    }
    html += '  <div class="bench-challenge-footer">';
    html += '    <span class="bench-challenge-timer" id="bench-timer">' + challenge.timeLimit + ' min</span>';
    if (challenge.bonus) {
      html += '    <span class="bench-challenge-bonus">' + BrickBotUI.escapeHtml(challenge.bonus) + '</span>';
    }
    html += '    <button class="bench-challenge-share" id="bench-share-btn">I did it! Share \u2192</button>';
    html += '  </div>';
    html += '</div>';
    html += '</div>';
    resultsSection.innerHTML = html;
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Share button
    document.getElementById('bench-share-btn').addEventListener('click', function () {
      var shareText = 'I built "' + challenge.title + '" with BrickBot! \uD83E\uDDF1 Try it at BrickBot.fun';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText).then(function () {
          showToast('Copied! Share it anywhere.');
        });
      } else {
        showToast(shareText);
      }
    });

    // Countdown timer
    startTimer(challenge.timeLimit);
  }

  function startTimer(minutes) {
    var timerEl = document.getElementById('bench-timer');
    if (!timerEl) return;
    var remaining = minutes * 60;

    var interval = setInterval(function () {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
        timerEl.textContent = 'Time\u2019s up!';
        timerEl.style.background = '#CC0000';
        timerEl.style.color = '#fff';
        return;
      }
      var m = Math.floor(remaining / 60);
      var s = remaining % 60;
      timerEl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    }, 1000);
  }

  buildBtn.addEventListener('click', function () {
    if (benchState.pieces.length < 2) {
      showToast('Add at least 2 pieces to your bench first!');
      return;
    }
    buildBtn.disabled = true;
    buildBtn.textContent = 'Thinking...';
    resultsSection.innerHTML =
      '<div class="bench-results-inner">' +
        '<div class="ideas-loading">' +
          '<div class="loading-spinner"></div>' +
          '<p class="loading-text" style="color:var(--muted-gray);">BrickBot is thinking...</p>' +
        '</div>' +
      '</div>';
    resultsSection.style.display = 'block';

    BrickBotAPI.getBenchIdeas(
      preparePiecesPayload(), benchState.ageGroup, benchState.topics
    ).then(function (data) {
      benchState.results = data.ideas;
      renderBenchIdeas(data.ideas);
      buildBtn.disabled = false;
      buildBtn.textContent = 'What can I build?';
    }).catch(function () {
      resultsSection.innerHTML =
        '<div class="bench-results-inner">' +
          '<p class="ideas-error">BrickBot is thinking hard... try again in a moment.</p>' +
          '<button class="retry-btn" style="margin-top:8px;" onclick="document.getElementById(\'bench-build-btn\').click()">Retry</button>' +
        '</div>';
      resultsSection.style.display = 'block';
      buildBtn.disabled = false;
      buildBtn.textContent = 'What can I build?';
    });
  });

  challengeBtn.addEventListener('click', function () {
    if (benchState.pieces.length < 2) {
      showToast('Add at least 2 pieces to your bench first!');
      return;
    }
    challengeBtn.disabled = true;
    challengeBtn.textContent = 'Thinking...';
    resultsSection.innerHTML =
      '<div class="bench-results-inner">' +
        '<div class="ideas-loading">' +
          '<div class="loading-spinner"></div>' +
          '<p class="loading-text" style="color:var(--muted-gray);">BrickBot is cooking up a challenge...</p>' +
        '</div>' +
      '</div>';
    resultsSection.style.display = 'block';

    BrickBotAPI.getChallenge(
      preparePiecesPayload(), benchState.ageGroup, benchState.topics
    ).then(function (data) {
      benchState.challenge = data;
      renderChallenge(data);
      challengeBtn.disabled = false;
      challengeBtn.textContent = 'Challenge me!';
    }).catch(function () {
      resultsSection.innerHTML =
        '<div class="bench-results-inner">' +
          '<p class="ideas-error">BrickBot is thinking hard... try again in a moment.</p>' +
          '<button class="retry-btn" style="margin-top:8px;" onclick="document.getElementById(\'bench-challenge-btn\').click()">Retry</button>' +
        '</div>';
      resultsSection.style.display = 'block';
      challengeBtn.disabled = false;
      challengeBtn.textContent = 'Challenge me!';
    });
  });

  // --- Event listeners ---
  searchInput.addEventListener('input', handleSearchInput);
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(searchDebounceTimer);
      var query = searchInput.value.trim();
      if (/^\d+$/.test(query)) {
        BrickBotAPI.getPart(query).then(function (part) {
          renderSearchResults([part], query);
        }).catch(function () {
          searchResultsGrid.innerHTML = '';
          searchNoResults.style.display = 'block';
          searchResultsLabel.textContent = 'No results for "' + query + '"';
          searchResultsArea.style.display = 'block';
        });
      } else if (query) {
        searchParts(query);
      }
    }
  });

  photoBtn.addEventListener('click', handlePhotoSearchBtn);

  // Hint chips
  document.querySelectorAll('.hint-chip[data-query]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var query = chip.getAttribute('data-query');
      searchInput.value = query;
      searchParts(query);
    });
  });

  clearBtn.addEventListener('click', clearBench);

  ghostCard.addEventListener('click', function () {
    searchInput.focus();
  });

  // --- Init ---
  var restored = loadFromLocalStorage();
  renderPieceGrid();
  initFilters();

  if (restored) {
    showToast('Welcome back! Your bench was saved.');
  }

  // Expose for use by other pages (add-to-bench from part.html)
  window.BrickBotBench = {
    addPiece: addPiece,
    state: benchState,
    showToast: showToast
  };

})();
