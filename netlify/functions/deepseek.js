export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!DEEPSEEK_API_KEY) {
    return {
      statusCode: 503,
      body: JSON.stringify({
        error: 'The server is missing DEEPSEEK_API_KEY. Add it to your environment before using AI analysis.',
      }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON payload. A sleep summary is required.' }),
    };
  }

  const summary = body?.summary;
  if (typeof summary !== 'string' || !summary.trim()) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'A sleep summary is required.' }),
    };
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content:
              'You are a warm sleep analyst and wellness coach. Use natural language, short headings, and concise practical advice. Be encouraging but honest. Keep the answer around 400 to 600 words.',
          },
          {
            role: 'user',
            content: `Here is my sleep data. Please analyze my sleep patterns and give me personalized insights and recommendations:\n\n${summary}\n\nPlease cover:\n1. An overall assessment of my sleep health\n2. Key patterns you notice\n3. My biggest strength and biggest area for improvement\n4. 2-3 specific recommendations tailored to my data\n5. Any connection between my notes and sleep quality if applicable`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        stream: false,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: data?.error?.message || `DeepSeek request failed with status ${response.status}`,
        }),
      };
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'DeepSeek returned an empty response.' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({
        error: 'Unable to reach DeepSeek right now.',
      }),
    };
  }
};
