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

Format each idea EXACTLY like this — include every label, do not skip any:

IDEA [number]: [catchy name]
DIFFICULTY: [Beginner / Intermediate / Advanced]
DESCRIPTION: [2 sentences max, enthusiastic, mentions the actual piece names]
PIECES USED: [comma-separated part numbers from the bench that this idea uses]
STEPS:
- [Step 1 — short, specific, fun. Mention the actual piece name.]
- [Step 2]
- [Step 3]
- [Step 4]
- [Step 5 — final step, describe what the finished build looks like]

Rules:
- Write exactly 5 steps per idea. No more, no less.
- Steps should be loose guidance, not precise engineering. Think "grab your 2x4 brick and lay it flat as your base" not "place element #3001 at coordinates X,Y".
- Only use pieces from the list. Never suggest pieces they don't have.
- Each idea should use a DIFFERENT combination of pieces.
- Make kids excited. High energy. Like a LEGO-obsessed best friend is talking.
- Do not suggest buying more pieces.`;

    console.log('[get-bench-ideas] Calling Anthropic API, model:', model, 'pieces:', pieces.length);

    const response = await client.messages.create({
      model,
      max_tokens: 2000,
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

      // Extract steps: find STEPS: line, collect all "- " lines after it
      const steps = [];
      const stepsSection = block.match(/STEPS:\s*\n([\s\S]+?)(?=IDEA\s+\d+:|$)/i);
      if (stepsSection) {
        const stepLines = stepsSection[1].split('\n');
        for (const line of stepLines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('- ')) {
            steps.push(trimmed.substring(2).trim());
          }
        }
      }

      if (nameMatch && diffMatch && descMatch) {
        const piecesUsed = piecesMatch
          ? piecesMatch[1].trim().split(/[,\s]+/).map(s => s.replace(/^#/, '').trim()).filter(Boolean)
          : [];
        ideas.push({
          name: nameMatch[1].trim(),
          difficulty: diffMatch[1].trim(),
          description: descMatch[1].trim(),
          piecesUsed,
          steps
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
