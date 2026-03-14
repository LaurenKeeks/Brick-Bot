const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { message, conversationHistory } = JSON.parse(event.body);

    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

    const systemPrompt = `You are BrickBot, an enthusiastic LEGO-obsessed AI assistant for kids and fans of all ages.
You give creative, encouraging, specific build ideas. You speak in a friendly, exciting tone.
You never suggest buying more pieces — only use what someone might already have.
Keep your responses concise but enthusiastic — 2-4 short paragraphs max.`;

    const messages = [...(conversationHistory || []), { role: 'user', content: message }];

    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 800,
      system: systemPrompt,
      messages
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: response.content[0].text })
    };
  } catch (err) {
    console.error('chat-followup error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
