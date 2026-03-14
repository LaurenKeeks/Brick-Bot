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
    var cacheKey = 'rb_colors_' + partNum;
    var cached = getCached(cacheKey);
    if (cached) return cached;

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
    var cacheKey = 'rb_sets_' + partNum;
    var cached = getCached(cacheKey);
    if (cached) return cached;

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

  return { getPart: getPart, getColors: getColors, getSets: getSets };
})();
