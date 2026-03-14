exports.handler = async (event) => {
  const partNum = event.queryStringParameters.part;
  if (!partNum) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing part parameter' }) };
  }

  const headers = { 'Authorization': `key ${process.env.REBRICKABLE_API_KEY}` };
  const base = 'https://rebrickable.com/api/v3/lego';

  try {
    // Fetch part colors and master color list in parallel
    const [partColorsRes, allColorsRes] = await Promise.all([
      fetch(`${base}/parts/${encodeURIComponent(partNum)}/colors/?page_size=100`, { headers }),
      fetch(`${base}/colors/?page_size=200`, { headers })
    ]);

    if (!partColorsRes.ok) {
      return { statusCode: partColorsRes.status, body: JSON.stringify({ error: 'Colors not found' }) };
    }

    const partColorsData = await partColorsRes.json();

    // Build a color_id -> rgb lookup from the master list
    const rgbMap = {};
    if (allColorsRes.ok) {
      const allColorsData = await allColorsRes.json();
      for (const c of (allColorsData.results || [])) {
        rgbMap[c.id] = c.rgb;
      }
    }

    // Merge rgb values into each part color result
    const results = (partColorsData.results || []).map(c => ({
      ...c,
      color_rgb: rgbMap[c.color_id] || null
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...partColorsData, results })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
