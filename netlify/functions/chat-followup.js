exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { message, conversationHistory } = JSON.parse(event.body);

    const systemPrompt = `You are BrickBot, an enthusiastic LEGO-obsessed AI assistant for kids and fans of all ages.
You give creative, encouraging, specific build ideas. You speak in a friendly, exciting tone.
You never suggest buying more pieces — only use what someone might already have.
Keep your responses concise but enthusiastic — 2-4 short paragraphs max.`;

    const messages = [...(conversationHistory || []), { role: 'user', content: message }];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        system: systemPrompt,
        messages
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Claude API error:', response.status, errBody);
      return { statusCode: response.status, body: JSON.stringify({ error: 'Claude API error' }) };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: data.content[0].text })
    };
  } catch (err) {
    console.error('chat-followup error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
