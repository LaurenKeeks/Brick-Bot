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

    const systemPrompt = 'You are BrickBot, an enthusiastic LEGO-obsessed AI assistant running a build challenge.';

    const userPrompt = `A user has these LEGO pieces available:
${piecesList}

Create ONE exciting build challenge using only a SUBSET of their pieces (pick 2-5 pieces).

Target age: ${ageGroup}
Preferred topics: ${topicsStr}

Format your response EXACTLY like this:

CHALLENGE TITLE: [one punchy sentence, e.g. "Build something that floats using only 4 pieces"]
PIECES TO USE: [list only the part numbers to use for this challenge, comma-separated]
DESCRIPTION: [2-3 sentences explaining the challenge, what to build, why it's fun]
TIME LIMIT: [a suggested time in minutes — between 10 and 30]
BONUS: [one optional bonus twist, e.g. "Bonus: make it tall enough to be taller than your hand!"]

Rules:
- Pick a subset of their pieces — not all of them. That's the constraint that makes it fun.
- Be specific about what to build, not vague.
- Make it feel like a game show challenge. High energy.
- Only use pieces from the list. Never suggest pieces they don't have.`;

    console.log('[get-challenge] Calling Anthropic API, model:', model, 'pieces:', pieces.length);

    const response = await client.messages.create({
      model,
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const rawText = response.content[0].text;
    console.log('[get-challenge] SUCCESS, parsing response');

    // Parse structured challenge from Claude's text
    const titleMatch = rawText.match(/CHALLENGE TITLE:\s*(.+?)(?:\n|$)/i);
    const piecesMatch = rawText.match(/PIECES TO USE:\s*(.+?)(?:\n|$)/i);
    const descMatch = rawText.match(/DESCRIPTION:\s*([\s\S]+?)(?=TIME LIMIT:|$)/i);
    const timeMatch = rawText.match(/TIME LIMIT:\s*(\d+)/i);
    const bonusMatch = rawText.match(/BONUS:\s*(.+?)(?:\n|$)/i);

    const piecesUsed = piecesMatch
      ? piecesMatch[1].trim().split(/[,\s]+/).map(s => s.replace(/^#/, '').trim()).filter(Boolean)
      : [];

    const challenge = {
      title: titleMatch ? titleMatch[1].trim() : 'BrickBot Challenge',
      piecesUsed,
      description: descMatch ? descMatch[1].trim() : rawText,
      timeLimit: timeMatch ? parseInt(timeMatch[1], 10) : 15,
      bonus: bonusMatch ? bonusMatch[1].trim() : ''
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(challenge)
    };
  } catch (err) {
    console.error('[get-challenge] ERROR:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
