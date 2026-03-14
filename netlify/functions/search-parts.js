exports.handler = async (event) => {
  const query = (event.queryStringParameters.q || '').trim();
  if (!query) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing q parameter' }) };
  }

  const page = parseInt(event.queryStringParameters.page || '1', 10);
  const cat = (event.queryStringParameters.cat || '').trim();
  const apiKey = process.env.REBRICKABLE_API_KEY;
  const headers = { 'Authorization': `key ${apiKey}` };
  const base = 'https://rebrickable.com/api/v3/lego';

  try {
    // If query is a pure number, fetch that specific part directly
    if (/^\d+$/.test(query)) {
      const res = await fetch(`${base}/parts/${encodeURIComponent(query)}/`, { headers });
      if (!res.ok) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results: [], count: 0 })
        };
      }
      const part = await res.json();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: [part], count: 1 })
      };
    }

    // Build search URL with pagination and optional category
    let url = `${base}/parts/?search=${encodeURIComponent(query)}&page_size=8&page=${page}`;
    if (cat) {
      url += `&part_cat_id=${encodeURIComponent(cat)}`;
    }

    const res = await fetch(url, { headers });

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: 'Search failed' }) };
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        results: data.results || [],
        count: data.count || 0,
        next: data.next ? true : false
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
