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

  // Support both single image (legacy) and multiple images
  let images = parsedBody.images;
  if (!images && parsedBody.imageBase64) {
    images = [{ base64: parsedBody.imageBase64, mediaType: parsedBody.mediaType || 'image/jpeg' }];
  }

  if (!images || images.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing image data' }) };
  }

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';

    // Build content array: all images first, then the text prompt
    const content = [];
    for (const img of images) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.base64 }
      });
    }

    const photoCount = images.length === 1 ? 'this image' : 'these ' + images.length + ' images (different angles of the same piece)';

    content.push({
      type: 'text',
      text: `You are a LEGO piece identification expert. A user is showing you a LEGO piece — it may be held in their hand, sitting on a desk, or on any surface. The background may not be clean or white.

Examine ${photoCount} carefully. Focus on the SHAPE, COLOR, STUD PATTERN, and STRUCTURE of the LEGO piece itself. Ignore the background, fingers, and other non-LEGO objects.

IMPORTANT RULES:
- You must ALWAYS return your best guess, even if you are unsure. Never refuse to identify.
- If you see a standard brick shape with studs on top, consider common bricks (3001, 3002, 3003, 3004, 3005, 3010, etc.)
- If you see a flat piece without height, consider plates (3020, 3021, 3023, 3024, etc.)
- If you see a sloped piece, consider slopes (3040, 3039, 3038, etc.)
- Count the studs to determine the size (e.g. 2x4 = 8 studs in a rectangle)
- A "Low" confidence guess is still valuable — always provide one.

Respond ONLY with valid JSON in this exact format, no other text:
{
  "partName": "exact LEGO part name e.g. Brick 2 x 4",
  "partNumber": "part number as string e.g. 3001",
  "confidence": "High or Medium or Low",
  "reasoning": "one sentence explaining why you chose this identification",
  "alternatives": [
    { "partName": "alternative name", "partNumber": "alt part number" },
    { "partName": "alternative name 2", "partNumber": "alt part number 2" }
  ]
}

Always include at least 2 alternatives. Return your BEST GUESS — do not say you cannot identify it.`
    });

    const response = await client.messages.create({
      model,
      max_tokens: 600,
      messages: [{ role: 'user', content }]
    });

    const raw = response.content[0].text;
    // Try to extract JSON from the response even if there's extra text
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed)
        };
      } catch (e) {
        // fall through
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Could not parse response', raw })
    };
  } catch (err) {
    console.error('[identify-photo] ERROR:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
