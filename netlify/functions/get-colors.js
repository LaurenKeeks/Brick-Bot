exports.handler = async (event) => {
  const partNum = event.queryStringParameters.part;
  if (!partNum) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing part parameter' }) };
  }

  try {
    const response = await fetch(
      `https://rebrickable.com/api/v3/lego/parts/${encodeURIComponent(partNum)}/colors/?page_size=100`,
      { headers: { 'Authorization': `key ${process.env.REBRICKABLE_API_KEY}` } }
    );

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: 'Colors not found' }) };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
