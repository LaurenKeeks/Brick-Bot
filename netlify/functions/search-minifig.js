exports.handler = async (event) => {
  const query = (event.queryStringParameters.q || '').trim();
  if (!query) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing q parameter' }) };
  }

  const apiKey = process.env.REBRICKABLE_API_KEY;
  const headers = { 'Authorization': `key ${apiKey}` };

  try {
    const res = await fetch(
      `https://rebrickable.com/api/v3/lego/minifigs/?search=${encodeURIComponent(query)}&page_size=5`,
      { headers }
    );

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: 'Search failed' }) };
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: data.results || [], count: data.count || 0 })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
