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

  const { ideaName, pieces, ageGroup, topics } = parsedBody;

  if (!ideaName || !pieces || pieces.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing ideaName or pieces' }) };
  }

  const piecesList = pieces.map(p => `- ${p.partName} (Part #${p.partNumber})`).join('\n');
  const topicsStr = topics && topics.length > 0 ? topics.join(', ') : 'anything fun';

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';

    const systemPrompt = 'You are BrickBot, an enthusiastic LEGO-obsessed AI assistant.';

    const userPrompt = `A user wants to build: ${ideaName}

They have these LEGO pieces available:
${piecesList}

Target age: ${ageGroup}
Preferred topics: ${topicsStr}

Generate a full build guide for ${ideaName} using only the pieces listed above.

Format your response EXACTLY like this:

DIFFICULTY: [Beginner / Intermediate / Advanced]
DESCRIPTION: [3-4 sentences. Enthusiastic. Describe what the finished build looks like and why it's cool.]
STEPS:
- [Step 1 — specific, fun, mentions actual piece names]
- [Step 2]
- [Step 3]
- [Step 4]
- [Step 5]
- [Step 6]
- [Step 7 — final step, describe the finished build and celebrate it]

Rules:
- Exactly 7 steps. More detail than the bench cards — this is the full guide.
- Only use the pieces provided. Never suggest pieces they don't have.
- Mention actual piece names (e.g. "Brick 2x4") not generic terms.
- Make each step feel achievable and fun. End with a celebration.`;

    console.log('[get-idea-detail] Calling Anthropic API, model:', model, 'idea:', ideaName);

    const response = await client.messages.create({
      model,
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const rawText = response.content[0].text;

    const diffMatch = rawText.match(/DIFFICULTY:\s*(.+?)(?:\n|$)/i);
    const descMatch = rawText.match(/DESCRIPTION:\s*([\s\S]+?)(?=STEPS:|$)/i);

    const steps = [];
    const stepsSection = rawText.match(/STEPS:\s*\n([\s\S]+?)$/i);
    if (stepsSection) {
      const stepLines = stepsSection[1].split('\n');
      for (const line of stepLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
          steps.push(trimmed.substring(2).trim());
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        difficulty: diffMatch ? diffMatch[1].trim() : 'Intermediate',
        description: descMatch ? descMatch[1].trim() : '',
        steps
      })
    };
  } catch (err) {
    console.error('[get-idea-detail] ERROR:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
