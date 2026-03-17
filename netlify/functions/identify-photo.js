const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let parsedBody;
  try {
    parsedBody = JSON.parse(event.body);
  } catch (e) {
    console.error('[identify-photo] Body parse error:', e.message);
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  let imageBase64, mediaType;
  if (parsedBody.images && parsedBody.images.length > 0) {
    imageBase64 = parsedBody.images[0].base64;
    mediaType = parsedBody.images[0].mediaType || 'image/jpeg';
  } else if (parsedBody.imageBase64) {
    imageBase64 = parsedBody.imageBase64;
    mediaType = parsedBody.mediaType || 'image/jpeg';
  }

  if (!imageBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing image data' }) };
  }

  console.log('[identify-photo] Received image, length:', imageBase64.length, 'mediaType:', mediaType);

  const rbHeaders = { 'Authorization': `key ${process.env.REBRICKABLE_API_KEY}` };
  const rbBase = 'https://rebrickable.com/api/v3/lego';

  function scoreToConfidence(score) {
    if (score >= 0.7) return 'High';
    if (score >= 0.35) return 'Medium';
    return 'Low';
  }

  // Helper: enrich a minifig ID via Rebrickable
  async function enrichMinifig(figNum, name, imgUrl, confidence) {
    let figData = null;
    // Try direct lookup first
    try {
      const res = await fetch(`${rbBase}/minifigs/${encodeURIComponent(figNum)}/`, { headers: rbHeaders });
      if (res.ok) figData = await res.json();
    } catch (e) {}

    // If direct lookup failed and we have a name, search by name
    if (!figData && name) {
      try {
        const searchRes = await fetch(`${rbBase}/minifigs/?search=${encodeURIComponent(name)}&page_size=1`, { headers: rbHeaders });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.results && searchData.results.length > 0) {
            figData = searchData.results[0];
          }
        }
      } catch (e) {}
    }

    if (figData) {
      return {
        partType: 'minifig',
        partName: figData.name || name,
        partNumber: figData.set_num || figNum,
        partImgUrl: figData.set_img_url || imgUrl || '',
        numParts: figData.num_parts || 0,
        confidence
      };
    }

    return {
      partType: 'minifig',
      partName: name || figNum,
      partNumber: figNum,
      partImgUrl: imgUrl || '',
      confidence
    };
  }

  // Helper: enrich a part ID via Rebrickable
  async function enrichPart(partNum, name, imgUrl, confidence) {
    try {
      const res = await fetch(`${rbBase}/parts/${encodeURIComponent(partNum)}/`, { headers: rbHeaders });
      if (res.ok) {
        const data = await res.json();
        return {
          partType: 'part',
          partName: data.name || name,
          partNumber: data.part_num || partNum,
          partImgUrl: data.part_img_url || imgUrl || '',
          confidence
        };
      }
    } catch (e) {}
    return { partType: 'part', partName: name || partNum, partNumber: partNum, partImgUrl: imgUrl || '', confidence };
  }

  // --- Try Brickognize first ---
  let brickognizeResult = null;
  try {
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const ext = mediaType.includes('png') ? 'png' : 'jpg';

    const boundary = '----BrickBotBoundary' + Date.now();
    const headerStr = [
      '--' + boundary + '\r\n',
      'Content-Disposition: form-data; name="query_image"; filename="photo.' + ext + '"\r\n',
      'Content-Type: ' + mediaType + '\r\n\r\n'
    ].join('');
    const multipartBody = Buffer.concat([
      Buffer.from(headerStr),
      imageBuffer,
      Buffer.from('\r\n--' + boundary + '--\r\n')
    ]);

    console.log('[identify-photo] Calling Brickognize API, body size:', multipartBody.length);
    const brickognizeRes = await fetch('https://api.brickognize.com/predict/', {
      method: 'POST',
      body: multipartBody,
      headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary }
    });

    console.log('[identify-photo] Brickognize status:', brickognizeRes.status);

    if (brickognizeRes.ok) {
      const brickognizeData = await brickognizeRes.json();
      const items = brickognizeData.items || [];
      console.log('[identify-photo] Brickognize items:', items.length, 'top:', items[0] ? items[0].id + ' (' + items[0].category + ')' : 'none');

      if (items.length > 0 && items[0].id) {
        brickognizeResult = items;
      }
    } else {
      const errText = await brickognizeRes.text();
      console.error('[identify-photo] Brickognize error:', errText);
    }
  } catch (err) {
    console.error('[identify-photo] Brickognize exception:', err.message);
  }

  // --- If Brickognize returned results, enrich and return ---
  if (brickognizeResult && brickognizeResult.length > 0) {
    try {
      const topItem = brickognizeResult[0];
      const isMinifig = (topItem.category || '').toLowerCase().includes('minifig') ||
                        (topItem.id || '').startsWith('fig-');

      const topConf = scoreToConfidence(topItem.score);
      const topResult = isMinifig
        ? await enrichMinifig(topItem.id, topItem.name, topItem.img_url, topConf)
        : await enrichPart(topItem.id, topItem.name, topItem.img_url, topConf);

      // Alternatives
      const altItems = brickognizeResult.slice(1, 3);
      const alternatives = await Promise.all(altItems.map(async (item) => {
        const altIsMinifig = (item.category || '').toLowerCase().includes('minifig') ||
                             (item.id || '').startsWith('fig-');
        const altConf = scoreToConfidence(item.score);
        if (altIsMinifig) {
          return await enrichMinifig(item.id, item.name, item.img_url, altConf);
        }
        return await enrichPart(item.id, item.name, item.img_url, altConf);
      }));

      const brickognizeResponse = {
        ...topResult,
        score: topItem.score,
        source: 'brickognize',
        alternatives
      };
      console.log('[identify-photo] FINAL RESPONSE (Brickognize):', JSON.stringify(brickognizeResponse));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brickognizeResponse)
      };
    } catch (err) {
      console.error('[identify-photo] Brickognize enrichment error:', err.message);
    }
  }

  // --- Fallback: Claude vision with minifig-aware prompt ---
  console.log('[identify-photo] Brickognize failed/empty, falling back to Claude...');

  const claudeApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!claudeApiKey) {
    console.error('[identify-photo] No Claude API key for fallback');
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Identification failed' }) };
  }

  try {
    const client = new Anthropic({ apiKey: claudeApiKey });
    const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';

    console.log('[identify-photo] Calling Claude vision, model:', model);

    const response = await client.messages.create({
      model,
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          {
            type: 'text',
            text: `You are a LEGO expert. Look at this image carefully. First determine: is this a LEGO minifigure (a small humanoid figure with a head, torso, legs, and sometimes accessories), or is it a regular LEGO part/brick?

If it's a MINIFIGURE, return this JSON:
{ "type": "minifig", "figName": "descriptive name e.g. Police Officer", "figNum": "fig number if known e.g. fig-000001 or empty string", "theme": "LEGO theme e.g. City, Star Wars", "confidence": "High/Medium/Low", "description": "one sentence", "alternatives": [{"figName": "...", "figNum": "..."}] }

If it's a REGULAR PART, return this JSON:
{ "type": "part", "partName": "exact name e.g. Brick 2 x 4", "partNumber": "part number e.g. 3001", "confidence": "High/Medium/Low", "description": "one sentence", "alternatives": [{"partName": "...", "partNumber": "..."}] }

You MUST always return one of these two JSON formats. Never refuse. If uncertain, give your best guess with Low confidence. Return ONLY JSON with no other text.`
          }
        ]
      }]
    });

    const raw = response.content[0].text;
    console.log('[identify-photo] Claude raw:', raw.substring(0, 300));

    let jsonStr = raw;
    const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    } else {
      const braceMatch = raw.match(/\{[\s\S]*\}/);
      if (braceMatch) jsonStr = braceMatch[0];
    }

    const parsed = JSON.parse(jsonStr);
    console.log('[identify-photo] Claude parsed type:', parsed.type, 'confidence:', parsed.confidence);

    // --- Minifig from Claude ---
    if (parsed.type === 'minifig') {
      const figName = parsed.figName || 'Unknown Minifigure';
      const figNum = parsed.figNum || '';

      // Search Rebrickable by name to get real fig data
      let enriched = null;
      if (figNum) {
        enriched = await enrichMinifig(figNum, figName, '', parsed.confidence || 'Low');
      }
      if (!enriched || !enriched.partImgUrl) {
        // Search by name
        try {
          const searchRes = await fetch(`${rbBase}/minifigs/?search=${encodeURIComponent(figName)}&page_size=3`, { headers: rbHeaders });
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const results = searchData.results || [];
            if (results.length > 0) {
              enriched = {
                partType: 'minifig',
                partName: results[0].name,
                partNumber: results[0].set_num,
                partImgUrl: results[0].set_img_url || '',
                numParts: results[0].num_parts || 0,
                confidence: parsed.confidence || 'Medium'
              };
            }
          }
        } catch (e) {}
      }

      if (!enriched) {
        enriched = { partType: 'minifig', partName: figName, partNumber: figNum, partImgUrl: '', confidence: parsed.confidence || 'Low' };
      }

      // Alternatives
      const alts = (parsed.alternatives || []).slice(0, 2);
      const altResults = [];
      for (const alt of alts) {
        if (alt.figName) {
          try {
            const sr = await fetch(`${rbBase}/minifigs/?search=${encodeURIComponent(alt.figName)}&page_size=1`, { headers: rbHeaders });
            if (sr.ok) {
              const sd = await sr.json();
              if (sd.results && sd.results.length > 0) {
                altResults.push({
                  partType: 'minifig',
                  partName: sd.results[0].name,
                  partNumber: sd.results[0].set_num,
                  partImgUrl: sd.results[0].set_img_url || '',
                  confidence: 'Low'
                });
                continue;
              }
            }
          } catch (e) {}
          altResults.push({ partType: 'minifig', partName: alt.figName, partNumber: alt.figNum || '', partImgUrl: '', confidence: 'Low' });
        }
      }

      const claudeMinifigResponse = {
        ...enriched,
        theme: parsed.theme || '',
        source: 'claude',
        alternatives: altResults
      };
      console.log('[identify-photo] FINAL RESPONSE (Claude minifig):', JSON.stringify(claudeMinifigResponse));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(claudeMinifigResponse)
      };
    }

    // --- Regular part from Claude ---
    const partResult = await enrichPart(parsed.partNumber || '', parsed.partName, '', parsed.confidence || 'Low');

    const partAlts = await Promise.all((parsed.alternatives || []).slice(0, 2).map(async (a) => {
      return await enrichPart(a.partNumber || '', a.partName, '', 'Low');
    }));

    const claudePartResponse = {
      ...partResult,
      source: 'claude',
      alternatives: partAlts
    };
    console.log('[identify-photo] FINAL RESPONSE (Claude part):', JSON.stringify(claudePartResponse));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(claudePartResponse)
    };
  } catch (err) {
    console.error('[identify-photo] Claude error:', JSON.stringify({ name: err.name, message: err.message, status: err.status }));
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Identification failed' }) };
  }
};
