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

  return {
    showError: showError,
    showLoading: showLoading,
    escapeHtml: escapeHtml,
    addRecentLookup: addRecentLookup
  };
})();
