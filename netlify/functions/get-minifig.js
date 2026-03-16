exports.handler = async (event) => {
  const figNum = event.queryStringParameters.fig;
  if (!figNum) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing fig parameter' }) };
  }

  const apiKey = process.env.REBRICKABLE_API_KEY;
  const headers = { 'Authorization': `key ${apiKey}` };
  const base = 'https://rebrickable.com/api/v3/lego';

  try {
    // Fetch minifig details
    const res = await fetch(
      `${base}/minifigs/${encodeURIComponent(figNum)}/`,
      { headers }
    );

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: 'Minifig not found' }) };
    }

    const data = await res.json();

    // Also fetch sets this minifig appears in
    let sets = [];
    try {
      const setsRes = await fetch(
        `${base}/minifigs/${encodeURIComponent(figNum)}/sets/?page_size=12`,
        { headers }
      );
      if (setsRes.ok) {
        const setsData = await setsRes.json();
        sets = setsData.results || [];
      }
    } catch (e) {
      // sets fetch failed, continue without
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, sets })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
