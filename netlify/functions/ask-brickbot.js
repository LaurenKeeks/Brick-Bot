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

  const { question, ideaName, pieces, ageGroup } = parsedBody;

  if (!question) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing question' }) };
  }

  const piecesList = (pieces || []).map(p => `- ${p.partName} (Part #${p.partNumber})`).join('\n');

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';

    const systemPrompt = 'You are BrickBot, an enthusiastic LEGO-obsessed AI assistant.';

    const userPrompt = `A user is building: ${ideaName || 'a LEGO creation'}
Their pieces: ${piecesList || 'various LEGO pieces'}
Their age group: ${ageGroup || 'Ages 9-12'}

They have a question: ${question}

Answer in 2-4 sentences. Be specific, helpful, and encouraging.
Only suggest substitutions using common LEGO pieces they might already have.
Do not suggest buying new pieces.`;

    const response = await client.messages.create({
      model,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: response.content[0].text })
    };
  } catch (err) {
    console.error('[ask-brickbot] ERROR:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
