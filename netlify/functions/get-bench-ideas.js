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

  const { pieces, ageGroup, topics } = parsedBody;

  if (!pieces || pieces.length < 2) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Need at least 2 pieces' }) };
  }

  const piecesList = pieces.map(p => `- ${p.partName} (Part #${p.partNumber})`).join('\n');
  const topicsStr = topics && topics.length > 0 ? topics.join(', ') : 'anything fun';

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';

    const systemPrompt = 'You are BrickBot, an enthusiastic LEGO-obsessed AI assistant.';

    const userPrompt = `A user has the following LEGO pieces on their Brick Bench:
${piecesList}

Generate exactly 3 creative build ideas using COMBINATIONS of these exact pieces.
Each idea should use at least 2 of the pieces listed.

Target age: ${ageGroup}
Preferred topics: ${topicsStr}

Format each idea EXACTLY like this (including the labels):

IDEA [number]: [catchy name]
DIFFICULTY: [Beginner / Intermediate / Advanced]
DESCRIPTION: [2-3 sentences, enthusiastic, specific, mentions the actual piece names]
PIECES USED: [comma-separated list of part numbers from the bench that this idea uses]

Rules:
- Only use pieces from the list above. Do not suggest any pieces they don't have.
- Be creative, specific, and encouraging. Make kids excited to start building.
- Do not suggest buying more pieces.
- Each idea should use a DIFFERENT combination of pieces so the ideas feel varied.`;

    console.log('[get-bench-ideas] Calling Anthropic API, model:', model, 'pieces:', pieces.length);

    const response = await client.messages.create({
      model,
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const rawText = response.content[0].text;
    console.log('[get-bench-ideas] SUCCESS, parsing response');

    // Parse structured ideas from Claude's text
    const ideas = [];
    const blocks = rawText.split(/IDEA\s+\d+:/i).filter(Boolean);
    for (const block of blocks) {
      const nameMatch = block.match(/^(.+?)\n/);
      const diffMatch = block.match(/DIFFICULTY:\s*(.+?)(?:\n|$)/i);
      const descMatch = block.match(/DESCRIPTION:\s*([\s\S]+?)(?=PIECES USED:|$)/i);
      const piecesMatch = block.match(/PIECES USED:\s*(.+?)(?:\n|$)/i);
      if (nameMatch && diffMatch && descMatch) {
        const piecesUsed = piecesMatch
          ? piecesMatch[1].trim().split(/[,\s]+/).map(s => s.replace(/^#/, '').trim()).filter(Boolean)
          : [];
        ideas.push({
          name: nameMatch[1].trim(),
          difficulty: diffMatch[1].trim(),
          description: descMatch[1].trim(),
          piecesUsed
        });
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ideas })
    };
  } catch (err) {
    console.error('[get-bench-ideas] ERROR:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
