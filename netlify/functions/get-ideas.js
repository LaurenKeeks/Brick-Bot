const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // --- Diagnostic logging ---
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';

  console.log('[get-ideas] ENV CHECK:', JSON.stringify({
    ANTHROPIC_API_KEY_set: !!process.env.ANTHROPIC_API_KEY,
    CLAUDE_API_KEY_set: !!process.env.CLAUDE_API_KEY,
    CLAUDE_MODEL_set: !!process.env.CLAUDE_MODEL,
    resolved_model: model,
    key_length: apiKey ? apiKey.length : 0,
    key_prefix: apiKey ? apiKey.substring(0, 12) + '...' : 'MISSING',
    key_suffix: apiKey ? '...' + apiKey.substring(apiKey.length - 6) : 'MISSING',
  }));

  if (!apiKey) {
    console.error('[get-ideas] FATAL: No API key found in ANTHROPIC_API_KEY or CLAUDE_API_KEY');
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let parsedBody;
  try {
    parsedBody = JSON.parse(event.body);
  } catch (parseErr) {
    console.error('[get-ideas] Body parse error:', parseErr.message, 'Raw body:', event.body);
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { partName, partNumber, category, ageGroup, topics, conversationHistory } = parsedBody;

  console.log('[get-ideas] REQUEST:', JSON.stringify({
    partName, partNumber, category, ageGroup, topics,
    historyLength: conversationHistory ? conversationHistory.length : 0,
  }));

  try {
    const client = new Anthropic({ apiKey });

    const systemPrompt = `You are BrickBot, an enthusiastic LEGO-obsessed AI assistant for kids and fans of all ages.
You give creative, encouraging, specific build ideas. You speak in a friendly, exciting tone.
You never suggest buying more pieces — only use what someone might already have.`;

    const userPrompt = `I have a LEGO piece:
Part name: ${partName}
Part number: ${partNumber}
Category: ${category}

Give me exactly 5 creative build ideas using this piece as the STAR of the build.
Target age group: ${ageGroup}
Preferred topics: ${topics.length > 0 ? topics.join(', ') : 'anything fun'}

Format each idea exactly like this:
IDEA 1: [catchy name]
DIFFICULTY: [Beginner / Intermediate / Advanced]
DESCRIPTION: [2-3 sentences, enthusiastic, mention the specific part, tell them what to do with it]

Make kids excited to start building. Be specific about HOW the part is used.`;

    const messages = conversationHistory && conversationHistory.length > 0
      ? [...conversationHistory, { role: 'user', content: userPrompt }]
      : [{ role: 'user', content: userPrompt }];

    console.log('[get-ideas] Calling Anthropic API with model:', model, 'messages count:', messages.length);

    const response = await client.messages.create({
      model,
      max_tokens: 1200,
      system: systemPrompt,
      messages
    });

    console.log('[get-ideas] SUCCESS: model=%s, stop_reason=%s, usage=%j',
      response.model, response.stop_reason, response.usage);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ideas: response.content[0].text })
    };
  } catch (err) {
    // Log every detail of the error
    console.error('[get-ideas] ERROR:', JSON.stringify({
      name: err.name,
      message: err.message,
      status: err.status,
      error_type: err.error?.type,
      error_detail: err.error?.error,
      headers: err.headers,
      stack: err.stack,
    }, null, 2));

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
