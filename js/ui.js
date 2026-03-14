// BrickBot — DOM helpers

var BrickBotUI = (function () {
  'use strict';

  function showError(container, message) {
    container.innerHTML =
      '<div class="error-card">' +
        '<div class="error-icon">😕</div>' +
        '<p class="error-text">' + escapeHtml(message) + '</p>' +
        '<a href="index.html" class="error-back-btn">Back to search</a>' +
      '</div>';
  }

  function showLoading(container) {
    container.innerHTML =
      '<div class="loading-state">' +
        '<div class="loading-spinner"></div>' +
        '<p class="loading-text">BrickBot is looking that up...</p>' +
      '</div>';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function addRecentLookup(partNum, name, imgUrl) {
    var recent = JSON.parse(localStorage.getItem('brickbot_recent') || '[]');
    // Remove duplicate if exists
    recent = recent.filter(function (item) { return item.partNum !== partNum; });
    recent.unshift({ partNum: partNum, name: name, imgUrl: imgUrl });
    // Keep max 20
    if (recent.length > 20) recent = recent.slice(0, 20);
    localStorage.setItem('brickbot_recent', JSON.stringify(recent));
  }

  function parseIdeas(text) {
    var ideas = [];
    var blocks = text.split(/IDEA \d+:/i).filter(Boolean);
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      var nameMatch = block.match(/^(.+?)\n/);
      var diffMatch = block.match(/DIFFICULTY:\s*(.+?)(?:\n|$)/i);
      var descMatch = block.match(/DESCRIPTION:\s*([\s\S]+?)(?=IDEA \d+:|$)/i);
      if (nameMatch && diffMatch && descMatch) {
        ideas.push({
          name: nameMatch[1].trim(),
          difficulty: diffMatch[1].trim(),
          description: descMatch[1].trim()
        });
      }
    }
    return ideas;
  }

  function difficultyColor(difficulty) {
    var d = difficulty.toLowerCase();
    if (d.indexOf('beginner') !== -1) return '#00A650';
    if (d.indexOf('intermediate') !== -1) return '#FFD700';
    if (d.indexOf('advanced') !== -1) return '#CC0000';
    return '#888888';
  }

  return {
    showError: showError,
    showLoading: showLoading,
    escapeHtml: escapeHtml,
    addRecentLookup: addRecentLookup,
    parseIdeas: parseIdeas,
    difficultyColor: difficultyColor
  };
})();
