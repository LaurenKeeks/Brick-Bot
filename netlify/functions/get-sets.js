// Rebrickable has no /parts/{num}/sets/ endpoint.
// The real endpoint is /parts/{num}/colors/{color_id}/sets/.
// This function fetches colors first, then aggregates sets across
// the top colors (by num_sets), deduplicates, and returns them.

exports.handler = async (event) => {
  const partNum = event.queryStringParameters.part;
  const pageSize = parseInt(event.queryStringParameters.page_size || '12', 10);
  if (!partNum) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing part parameter' }) };
  }

  const apiKey = process.env.REBRICKABLE_API_KEY;
  const headers = { 'Authorization': `key ${apiKey}` };
  const base = 'https://rebrickable.com/api/v3/lego';

  try {
    // Step 1: Get all colors for this part
    const colorsRes = await fetch(
      `${base}/parts/${encodeURIComponent(partNum)}/colors/?page_size=100`,
      { headers }
    );
    if (!colorsRes.ok) {
      return { statusCode: colorsRes.status, body: JSON.stringify({ error: 'Part not found' }) };
    }
    const colorsData = await colorsRes.json();
    const colors = colorsData.results || [];

    if (colors.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 0, results: [] })
      };
    }

    // Step 2: Sort colors by num_sets descending, pick top 5 to limit API calls
    const topColors = colors
      .sort((a, b) => (b.num_sets || 0) - (a.num_sets || 0))
      .slice(0, 5);

    // Step 3: Fetch sets for each top color in parallel
    const setPromises = topColors.map(async (c) => {
      const url = `${base}/parts/${encodeURIComponent(partNum)}/colors/${c.color_id}/sets/?page_size=100`;
      const res = await fetch(url, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return data.results || [];
    });
    const setsArrays = await Promise.all(setPromises);

    // Step 4: Flatten and deduplicate by set_num
    const seen = new Set();
    const allSets = [];
    for (const arr of setsArrays) {
      for (const s of arr) {
        if (!seen.has(s.set_num)) {
          seen.add(s.set_num);
          allSets.push(s);
        }
      }
    }

    // Sort by year descending (newest first)
    allSets.sort((a, b) => (b.year || 0) - (a.year || 0));

    // Calculate total count from color metadata (sum of unique sets across all colors)
    const totalSets = colors.reduce((sum, c) => sum + (c.num_sets || 0), 0);

    // Return the requested page size
    const results = allSets.slice(0, pageSize);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: totalSets, results })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
