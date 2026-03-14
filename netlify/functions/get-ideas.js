exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Diagnostic: check if API key is present
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'CLAUDE_API_KEY env var is not set', envKeys: Object.keys(process.env).filter(k => k.includes('CLAUDE') || k.includes('ANTHROPIC') || k.includes('API')) })
    };
  }

  try {
    const { partName, partNumber, category, ageGroup, topics, conversationHistory } = JSON.parse(event.body);

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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2024-10-22',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1200,
        system: systemPrompt,
        messages
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Claude API error:', response.status, errBody);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Claude API error', status: response.status, detail: errBody })
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ideas: data.content[0].text })
    };
  } catch (err) {
    console.error('get-ideas error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
