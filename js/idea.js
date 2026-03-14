// BrickBot — Idea Detail Page Logic

(function () {
  'use strict';

  // --- Read URL parameters ---
  var params = new URLSearchParams(window.location.search);
  var nameSlug = params.get('name') || '';
  var piecesParam = params.get('pieces') || '';
  var ageGroup = params.get('age') || 'Ages 9-12';
  var topicsParam = params.get('topics') || '';

  var ideaName = nameSlug.replace(/-/g, ' ');
  var partNumbers = piecesParam.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var topics = topicsParam ? topicsParam.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];

  if (!ideaName || partNumbers.length === 0) {
    document.getElementById('idea-hero-inner').innerHTML =
      '<h1 style="color:white;">Missing idea parameters</h1>' +
      '<p class="idea-hero-sub"><a href="bench.html" style="color:var(--lego-yellow);">&larr; Back to My Bench</a></p>';
    return;
  }

  document.title = 'BrickBot — ' + ideaName;

  // --- State ---
  var piecesData = []; // full piece objects from Rebrickable
  var ideaDetail = null; // { difficulty, description, steps }

  // --- DOM refs ---
  var heroInner = document.getElementById('idea-hero-inner');
  var piecesGrid = document.getElementById('idea-pieces-grid');
  var stepsList = document.getElementById('idea-steps-list');
  var descriptionEl = document.getElementById('idea-description');
  var chatThread = document.getElementById('idea-chat-thread');

  // --- Toast ---
  function showToast(msg) {
    var existing = document.querySelector('.bench-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'bench-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('visible'); });
    setTimeout(function () {
      toast.classList.remove('visible');
      setTimeout(function () { toast.remove(); }, 300);
    }, 2500);
  }

  // --- Bench badge ---
  function updateBenchBadge() {
    try {
      var pieces = JSON.parse(localStorage.getItem('brickbot_bench_pieces') || '[]');
      var badge = document.getElementById('bench-badge');
      if (badge && pieces.length > 0) {
        badge.textContent = pieces.length;
        badge.style.display = 'inline-block';
      }
    } catch (e) {}
  }
  updateBenchBadge();

  // --- Render hero ---
  function renderHero(difficulty) {
    var badgeColor = BrickBotUI.difficultyColor(difficulty || 'Intermediate');
    heroInner.innerHTML =
      '<h1>' + BrickBotUI.escapeHtml(ideaName) + '</h1>' +
      '<div class="idea-hero-meta">' +
        '<span class="idea-diff-badge" id="idea-diff-badge" style="background:' + badgeColor + ';">' + BrickBotUI.escapeHtml(difficulty || 'Loading...') + '</span>' +
        '<span class="idea-hero-sub">A BrickBot build idea using ' + partNumbers.length + ' piece' + (partNumbers.length === 1 ? '' : 's') + '</span>' +
      '</div>';
  }

  // --- Render pieces grid ---
  function renderPieces() {
    piecesGrid.innerHTML = '';
    piecesData.forEach(function (piece) {
      var card = document.createElement('div');
      card.className = 'idea-piece-card';
      card.innerHTML =
        '<img src="' + (piece.part_img_url || '') + '" alt="' + BrickBotUI.escapeHtml(piece.name) + '" onerror="this.style.background=\'#eee\'">' +
        '<div class="piece-name">' + BrickBotUI.escapeHtml(piece.name) + '</div>' +
        '<div class="piece-num">#' + BrickBotUI.escapeHtml(piece.part_num) + '</div>' +
        '<a href="https://www.bricklink.com/v2/catalog/catalogitem.page?P=' + encodeURIComponent(piece.part_num) + '" target="_blank" rel="noopener">Find on BrickLink &rarr;</a>';
      piecesGrid.appendChild(card);
    });
  }

  // --- Render steps ---
  function renderSteps(steps) {
    stepsList.innerHTML = '';
    if (!steps || steps.length === 0) {
      stepsList.innerHTML = '<p style="color:var(--muted-gray);">No steps available.</p>';
      return;
    }
    steps.forEach(function (step, i) {
      var row = document.createElement('div');
      row.className = 'step-row';
      row.innerHTML =
        '<div class="step-number">' + (i + 1) + '</div>' +
        '<div class="step-text">' + BrickBotUI.escapeHtml(step) + '</div>';
      stepsList.appendChild(row);
    });
  }

  // --- Render full idea ---
  function renderIdea(data) {
    ideaDetail = data;
    renderHero(data.difficulty);
    descriptionEl.textContent = data.description || '';
    renderSteps(data.steps);
  }

  // --- Fetch idea detail from Claude ---
  function fetchIdeaDetail() {
    var piecesPayload = piecesData.map(function (p) {
      return { partName: p.name, partNumber: p.part_num, category: '' };
    });

    return fetch('/api/get-idea-detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ideaName: ideaName,
        pieces: piecesPayload,
        ageGroup: ageGroup,
        topics: topics
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('Failed to get idea detail');
      return res.json();
    });
  }

  // --- Copy share link ---
  document.getElementById('btn-copy-link').addEventListener('click', function () {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).then(function () {
        showToast('Link copied! Share it anywhere.');
      });
    }
  });

  // --- Add pieces to bench ---
  document.getElementById('btn-add-pieces').addEventListener('click', function () {
    var benchPieces = [];
    try { benchPieces = JSON.parse(localStorage.getItem('brickbot_bench_pieces') || '[]'); } catch (e) {}

    piecesData.forEach(function (piece) {
      var exists = benchPieces.some(function (p) { return p.part_num === piece.part_num; });
      if (!exists && benchPieces.length < 30) {
        benchPieces.push(piece);
      }
    });

    try { localStorage.setItem('brickbot_bench_pieces', JSON.stringify(benchPieces)); } catch (e) {}
    window.location.href = 'bench.html';
  });

  // --- Regenerate ---
  document.getElementById('btn-regenerate').addEventListener('click', function () {
    var btn = document.getElementById('btn-regenerate');
    btn.disabled = true;
    btn.textContent = 'Thinking...';

    // Fade out content
    var stepsSection = document.getElementById('idea-steps-section');
    stepsSection.classList.add('regenerating');
    descriptionEl.classList.add('regenerating');

    fetchIdeaDetail().then(function (data) {
      // Update hero name to match (keep same name, new content)
      renderIdea(data);
      stepsSection.classList.remove('regenerating');
      descriptionEl.classList.remove('regenerating');
      btn.disabled = false;
      btn.textContent = 'Regenerate \u2192';
      stepsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function () {
      showToast('BrickBot is thinking hard... try again in a moment.');
      stepsSection.classList.remove('regenerating');
      descriptionEl.classList.remove('regenerating');
      btn.disabled = false;
      btn.textContent = 'Regenerate \u2192';
    });
  });

  // --- Ask BrickBot ---
  document.getElementById('idea-ask-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = document.getElementById('idea-ask-input');
    var question = input.value.trim();
    if (!question) return;

    // Show user bubble
    chatThread.innerHTML +=
      '<div class="chat-bubble-user">' + BrickBotUI.escapeHtml(question) + '</div>';
    input.value = '';

    // Show thinking bubble
    chatThread.innerHTML +=
      '<div class="chat-bubble-bot" id="ask-thinking">BrickBot is thinking...</div>';

    var piecesPayload = piecesData.map(function (p) {
      return { partName: p.name, partNumber: p.part_num, category: '' };
    });

    fetch('/api/ask-brickbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question,
        ideaName: ideaName,
        pieces: piecesPayload,
        ageGroup: ageGroup
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('Failed');
      return res.json();
    }).then(function (data) {
      var thinking = document.getElementById('ask-thinking');
      if (thinking) thinking.remove();
      chatThread.innerHTML +=
        '<div class="chat-bubble-bot">' + BrickBotUI.escapeHtml(data.answer) + '</div>';
    }).catch(function () {
      var thinking = document.getElementById('ask-thinking');
      if (thinking) thinking.remove();
      chatThread.innerHTML +=
        '<div class="chat-bubble-bot">Oops! BrickBot couldn\u2019t answer. Try again!</div>';
    });
  });

  // --- Page load: fetch pieces then idea ---
  renderHero('Loading...');
  stepsList.innerHTML = '<div class="idea-loading"><div class="loading-spinner"></div><p class="loading-text" style="color:var(--muted-gray);">Loading build idea...</p></div>';

  // Fetch all pieces in parallel
  var piecePromises = partNumbers.map(function (num) {
    return BrickBotAPI.getPart(num).catch(function () { return null; });
  });

  Promise.all(piecePromises).then(function (results) {
    piecesData = results.filter(Boolean);
    renderPieces();

    if (piecesData.length === 0) {
      stepsList.innerHTML = '<p style="color:var(--muted-gray);">Could not load pieces. Check the URL and try again.</p>';
      return;
    }

    return fetchIdeaDetail();
  }).then(function (data) {
    if (data) {
      renderIdea(data);
    }
  }).catch(function () {
    stepsList.innerHTML = '<p style="color:var(--lego-red);">BrickBot couldn\u2019t generate this idea. Try regenerating below.</p>';
    descriptionEl.textContent = '';
    renderHero('Unknown');
  });

})();
