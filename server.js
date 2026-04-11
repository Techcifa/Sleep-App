import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

try {
  process.loadEnvFile?.();
} catch {
  // `.env` is optional; the server can also read variables from the host environment.
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = Number(process.env.PORT || 3001);
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const distPath = path.join(__dirname, 'dist');

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    providerConfigured: Boolean(DEEPSEEK_API_KEY),
  });
});

app.post('/api/deepseek', async (req, res) => {
  if (!DEEPSEEK_API_KEY) {
    res.status(503).json({
      error: 'The server is missing DEEPSEEK_API_KEY. Add it to your environment before using AI analysis.',
    });
    return;
  }

  const summary = req.body?.summary;
  if (typeof summary !== 'string' || !summary.trim()) {
    res.status(400).json({ error: 'A sleep summary is required.' });
    return;
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
      res.status(response.status).json({
        error: data?.error?.message || `DeepSeek request failed with status ${response.status}`,
      });
      return;
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      res.status(502).json({ error: 'DeepSeek returned an empty response.' });
      return;
    }

    res.json({ content });
  } catch {
    res.status(502).json({
      error: 'Unable to reach DeepSeek from the server right now.',
    });
  }
});

app.use(express.static(distPath));

app.use((_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Sleep app server running on http://localhost:${PORT}`);
});
