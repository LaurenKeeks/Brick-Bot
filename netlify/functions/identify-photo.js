const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let parsedBody;
  try {
    parsedBody = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { imageBase64, mediaType } = parsedBody;

  if (!imageBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing imageBase64' }) };
  }

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';

    const response = await client.messages.create({
      model,
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 }
          },
          {
            type: 'text',
            text: `You are a LEGO part identification expert. Examine this image carefully.
Respond ONLY with valid JSON in this exact format, no other text:
{
  "partName": "exact LEGO part name",
  "partNumber": "part number as string e.g. 3001",
  "confidence": "High or Medium or Low",
  "alternatives": [
    { "partName": "alternative name", "partNumber": "alt part number" },
    { "partName": "alternative name 2", "partNumber": "alt part number 2" }
  ]
}
If you cannot identify the piece at all, return confidence "Low" and your best guesses.`
          }
        ]
      }]
    });

    const raw = response.content[0].text;
    try {
      const parsed = JSON.parse(raw);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      };
    } catch (e) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Could not parse response', raw })
      };
    }
  } catch (err) {
    console.error('[identify-photo] ERROR:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
