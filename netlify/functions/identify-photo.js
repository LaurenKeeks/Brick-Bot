const FormData = require('form-data');
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

  // Get the image
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

  // --- Try Brickognize first ---
  let brickognizeResult = null;
  try {
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const ext = mediaType.includes('png') ? 'png' : 'jpg';

    const form = new FormData();
    form.append('query_image', imageBuffer, {
      filename: 'photo.' + ext,
      contentType: mediaType
    });

    console.log('[identify-photo] Calling Brickognize API...');
    const brickognizeRes = await fetch('https://api.brickognize.com/predict/', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    console.log('[identify-photo] Brickognize status:', brickognizeRes.status);

    if (brickognizeRes.ok) {
      const brickognizeData = await brickognizeRes.json();
      console.log('[identify-photo] Brickognize response:', JSON.stringify({
        itemCount: (brickognizeData.items || []).length,
        topItem: (brickognizeData.items || [])[0] || null
      }));

      const items = brickognizeData.items || [];
      if (items.length > 0 && items[0].id) {
        brickognizeResult = items;
      }
    } else {
      const errText = await brickognizeRes.text();
      console.error('[identify-photo] Brickognize error body:', errText);
    }
  } catch (err) {
    console.error('[identify-photo] Brickognize exception:', err.message);
  }

  // --- If Brickognize worked, enrich with Rebrickable and return ---
  if (brickognizeResult && brickognizeResult.length > 0) {
    try {
      const topItem = brickognizeResult[0];
      const altItems = brickognizeResult.slice(1, 3);

      // Fetch top match from Rebrickable
      let topPart = null;
      try {
        const partRes = await fetch(`${rbBase}/parts/${encodeURIComponent(topItem.id)}/`, { headers: rbHeaders });
        if (partRes.ok) topPart = await partRes.json();
        console.log('[identify-photo] Rebrickable top part:', topPart ? topPart.name : 'not found');
      } catch (e) {
        console.error('[identify-photo] Rebrickable top part error:', e.message);
      }

      // Fetch alternatives
      const alternatives = await Promise.all(altItems.map(async (item) => {
        try {
          const res = await fetch(`${rbBase}/parts/${encodeURIComponent(item.id)}/`, { headers: rbHeaders });
          if (res.ok) {
            const data = await res.json();
            return { partName: data.name, partNumber: data.part_num, partImgUrl: data.part_img_url || '', confidence: scoreToConfidence(item.score) };
          }
        } catch (e) {}
        return { partName: item.name || item.id, partNumber: item.id, partImgUrl: item.img_url || '', confidence: scoreToConfidence(item.score) };
      }));

      console.log('[identify-photo] SUCCESS via Brickognize:', topItem.id, 'score:', topItem.score);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partName: topPart ? topPart.name : (topItem.name || topItem.id),
          partNumber: topPart ? topPart.part_num : topItem.id,
          partImgUrl: topPart ? (topPart.part_img_url || '') : (topItem.img_url || ''),
          confidence: scoreToConfidence(topItem.score),
          score: topItem.score,
          partType: 'part',
          source: 'brickognize',
          alternatives
        })
      };
    } catch (err) {
      console.error('[identify-photo] Brickognize enrichment error:', err.message);
    }
  }

  // --- Fallback: use Claude vision ---
  console.log('[identify-photo] Brickognize failed or empty, falling back to Claude...');

  const claudeApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!claudeApiKey) {
    console.error('[identify-photo] No Claude API key available for fallback');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Identification failed — no fallback available' })
    };
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
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 }
          },
          {
            type: 'text',
            text: `You are a LEGO part identification expert. Look at this image and identify the LEGO piece shown. You MUST always return a JSON object — never refuse or say you can't identify it. If uncertain, give your best guess with Low confidence. Return ONLY this JSON with no other text: { "partName": "...", "partNumber": "...", "confidence": "High/Medium/Low", "description": "one sentence about this piece", "alternatives": [{"partName": "...", "partNumber": "..."}] }`
          }
        ]
      }]
    });

    const raw = response.content[0].text;
    console.log('[identify-photo] Claude raw response:', raw.substring(0, 300));

    // Extract JSON — handle markdown code fences, plain JSON, or JSON embedded in text
    let jsonStr = raw;
    const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    } else {
      const braceMatch = raw.match(/\{[\s\S]*\}/);
      if (braceMatch) jsonStr = braceMatch[0];
    }

    const parsed = JSON.parse(jsonStr);
    console.log('[identify-photo] SUCCESS via Claude:', parsed.partNumber, parsed.confidence);

    // Enrich with Rebrickable image
    let partImgUrl = '';
    if (parsed.partNumber) {
      try {
        const partRes = await fetch(`${rbBase}/parts/${encodeURIComponent(parsed.partNumber)}/`, { headers: rbHeaders });
        if (partRes.ok) {
          const partData = await partRes.json();
          partImgUrl = partData.part_img_url || '';
          if (partData.name) parsed.partName = partData.name;
        }
      } catch (e) {}
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partName: parsed.partName || 'Unknown',
        partNumber: parsed.partNumber || '',
        partImgUrl: partImgUrl,
        confidence: parsed.confidence || 'Low',
        partType: 'part',
        source: 'claude',
        alternatives: (parsed.alternatives || []).map(a => ({
          partName: a.partName || '',
          partNumber: a.partNumber || '',
          partImgUrl: ''
        }))
      })
    };
  } catch (err) {
    console.error('[identify-photo] Claude fallback error:', JSON.stringify({
      name: err.name,
      message: err.message,
      status: err.status
    }));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Identification failed' })
    };
  }
};
