// BrickBot — API calls with localStorage caching (24hr TTL)

var BrickBotAPI = (function () {
  'use strict';

  var CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  function getCached(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (Date.now() - entry.timestamp > CACHE_TTL) {
        localStorage.removeItem(key);
        return null;
      }
      return entry.data;
    } catch (e) {
      return null;
    }
  }

  function setCache(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ data: data, timestamp: Date.now() }));
    } catch (e) {
      // localStorage full — silently fail
    }
  }

  async function getPart(partNum) {
    var cacheKey = 'rb_part_' + partNum;
    var cached = getCached(cacheKey);
    if (cached) return cached;

    var res = await fetch('/api/get-part?part=' + encodeURIComponent(partNum));
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.error || 'Part not found');
    }
    var data = await res.json();
    setCache(cacheKey, data);
    return data;
  }

  async function getColors(partNum) {
    // v2 cache key — old cache had no color_rgb values
    var cacheKey = 'rb_colors_v2_' + partNum;
    var cached = getCached(cacheKey);
    if (cached) return cached;
    localStorage.removeItem('rb_colors_' + partNum);

    var res = await fetch('/api/get-colors?part=' + encodeURIComponent(partNum));
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.error || 'Colors not found');
    }
    var data = await res.json();
    setCache(cacheKey, data);
    return data;
  }

  async function getSets(partNum, pageSize) {
    // v2 cache key — invalidates old cached 404 errors from the broken endpoint
    var cacheKey = 'rb_sets_v2_' + partNum + (pageSize ? '_' + pageSize : '');
    var cached = getCached(cacheKey);
    if (cached) return cached;
    // Clear any old broken cache entry
    localStorage.removeItem('rb_sets_' + partNum);

    var url = '/api/get-sets?part=' + encodeURIComponent(partNum);
    if (pageSize) url += '&page_size=' + pageSize;
    var res = await fetch(url);
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.error || 'Sets not found');
    }
    var data = await res.json();
    setCache(cacheKey, data);
    return data;
  }

  async function getIdeas(partName, partNumber, category, ageGroup, topics, conversationHistory) {
    var res = await fetch('/api/get-ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partName: partName,
        partNumber: partNumber,
        category: category || 'General',
        ageGroup: ageGroup,
        topics: topics,
        conversationHistory: conversationHistory || []
      })
    });
    if (!res.ok) throw new Error('Failed to get ideas');
    return res.json();
  }

  async function chatFollowup(message, conversationHistory) {
    var res = await fetch('/api/chat-followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        conversationHistory: conversationHistory || []
      })
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  }

  return {
    getPart: getPart,
    getColors: getColors,
    getSets: getSets,
    getIdeas: getIdeas,
    chatFollowup: chatFollowup
  };
})();
