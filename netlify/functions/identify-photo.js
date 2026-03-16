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

  const rbHeaders = { 'Authorization': `key ${process.env.REBRICKABLE_API_KEY}` };
  const rbBase = 'https://rebrickable.com/api/v3/lego';

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
      text: `You are a LEGO identification expert. A user is showing you a LEGO item — it may be held in their hand, sitting on a desk, or on any surface. The background may not be clean or white.

Examine ${photoCount} carefully. Focus on the SHAPE, COLOR, STUD PATTERN, and STRUCTURE. Ignore the background, fingers, and other non-LEGO objects.

First, determine if this is:
A) A COMPLETE LEGO MINIFIGURE (small person-shaped figure with head, torso, legs)
B) An INDIVIDUAL LEGO PIECE (brick, plate, slope, wheel, or separate minifig head/torso/legs)

Respond ONLY with valid JSON in this exact format, no other text:

If it's a MINIFIGURE (type A):
{
  "partType": "minifig",
  "description": "detailed search description for Rebrickable, e.g. santa claus red torso white belt",
  "characterName": "who this minifigure represents, e.g. Santa Claus, Stormtrooper, Police Officer",
  "colors": "main colors visible, e.g. red, white, yellow",
  "theme": "likely LEGO theme, e.g. City, Star Wars, Harry Potter, Holiday, Ninjago",
  "confidence": "High or Medium or Low",
  "reasoning": "one sentence explaining what you see"
}

If it's a REGULAR PIECE (type B):
{
  "partType": "part",
  "partName": "exact LEGO part name e.g. Brick 2 x 4",
  "partNumber": "part number as string e.g. 3001",
  "confidence": "High or Medium or Low",
  "reasoning": "one sentence explaining why you chose this identification",
  "alternatives": [
    { "partName": "alternative name", "partNumber": "alt part number" },
    { "partName": "alternative name 2", "partNumber": "alt part number 2" }
  ]
}

IMPORTANT:
- For minifigures, DO NOT guess a fig number — describe what you see instead. Be specific about colors, clothing, accessories, and character.
- For regular pieces, return your best part number guess.
- You must ALWAYS return a response. Never refuse.
- A "Low" confidence guess is still valuable.`
    });

    const response = await client.messages.create({
      model,
      max_tokens: 600,
      messages: [{ role: 'user', content }]
    });

    const raw = response.content[0].text;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Could not parse response', raw })
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // --- Regular part: return as-is (part numbers are reliable) ---
    if (parsed.partType !== 'minifig') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      };
    }

    // --- Minifigure: search Rebrickable with Claude's description ---
    console.log('[identify-photo] Minifig detected, searching Rebrickable:', parsed.description);

    // Build search queries — try multiple to maximize hit rate
    const searches = [];
    if (parsed.characterName) searches.push(parsed.characterName);
    if (parsed.description) searches.push(parsed.description);
    if (parsed.theme && parsed.characterName) searches.push(parsed.characterName + ' ' + parsed.theme);

    let bestResults = [];

    for (const query of searches) {
      if (bestResults.length >= 3) break;
      try {
        const searchRes = await fetch(
          `${rbBase}/minifigs/?search=${encodeURIComponent(query)}&page_size=4`,
          { headers: rbHeaders }
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const results = searchData.results || [];
          for (const r of results) {
            if (!bestResults.find(b => b.set_num === r.set_num)) {
              bestResults.push(r);
            }
          }
        }
      } catch (e) {
        // continue to next search
      }
    }

    if (bestResults.length === 0) {
      // Fallback: return Claude's description without a match
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partType: 'minifig',
          partName: parsed.characterName || 'Unknown Minifigure',
          partNumber: '',
          confidence: 'Low',
          reasoning: parsed.reasoning || 'Could not find a matching minifigure in the database.',
          description: parsed.description,
          alternatives: []
        })
      };
    }

    // Top match
    const top = bestResults[0];
    const alternatives = bestResults.slice(1, 3).map(r => ({
      partName: r.name,
      partNumber: r.set_num,
      partType: 'minifig'
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partType: 'minifig',
        partName: top.name,
        partNumber: top.set_num,
        confidence: parsed.confidence || 'Medium',
        reasoning: parsed.reasoning || '',
        description: parsed.description,
        alternatives
      })
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
