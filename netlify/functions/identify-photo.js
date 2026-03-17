const FormData = require('form-data');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let parsedBody;
  try {
    parsedBody = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  // Get the image — support single or multi-image (use first image for Brickognize)
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

  const rbHeaders = { 'Authorization': `key ${process.env.REBRICKABLE_API_KEY}` };
  const rbBase = 'https://rebrickable.com/api/v3/lego';

  try {
    // Convert base64 to Buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // Determine file extension from media type
    const ext = mediaType.includes('png') ? 'png' : 'jpg';

    // Send to Brickognize as multipart form-data
    const form = new FormData();
    form.append('query_image', imageBuffer, {
      filename: 'photo.' + ext,
      contentType: mediaType
    });

    const brickognizeRes = await fetch('https://api.brickognize.com/predict/', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    if (!brickognizeRes.ok) {
      console.error('[identify-photo] Brickognize error:', brickognizeRes.status);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Identification failed' })
      };
    }

    const brickognizeData = await brickognizeRes.json();
    const items = brickognizeData.items || [];

    if (items.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No matches found' })
      };
    }

    // Map Brickognize score to confidence level
    function scoreToConfidence(score) {
      if (score >= 0.7) return 'High';
      if (score >= 0.35) return 'Medium';
      return 'Low';
    }

    // Take top match and up to 2 alternatives
    const topItem = items[0];
    const altItems = items.slice(1, 3);

    // Fetch top match details from Rebrickable
    let topPart = null;
    try {
      const partRes = await fetch(
        `${rbBase}/parts/${encodeURIComponent(topItem.id)}/`,
        { headers: rbHeaders }
      );
      if (partRes.ok) {
        topPart = await partRes.json();
      }
    } catch (e) {
      // continue without Rebrickable data
    }

    // Fetch alternative details from Rebrickable in parallel
    const altPromises = altItems.map(async (item) => {
      try {
        const res = await fetch(
          `${rbBase}/parts/${encodeURIComponent(item.id)}/`,
          { headers: rbHeaders }
        );
        if (res.ok) {
          const data = await res.json();
          return {
            partName: data.name,
            partNumber: data.part_num,
            partImgUrl: data.part_img_url || '',
            confidence: scoreToConfidence(item.score),
            score: item.score
          };
        }
      } catch (e) {}
      return {
        partName: item.name || item.id,
        partNumber: item.id,
        partImgUrl: item.img_url || '',
        confidence: scoreToConfidence(item.score),
        score: item.score
      };
    });

    const alternatives = await Promise.all(altPromises);

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
        alternatives: alternatives
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
