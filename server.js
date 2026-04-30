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
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const AI_RATE_LIMIT_WINDOW_MS = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 60_000);
const AI_RATE_LIMIT_MAX = Number(process.env.AI_RATE_LIMIT_MAX || 12);
const SUMMARY_MAX_CHARS = Number(process.env.AI_SUMMARY_MAX_CHARS || 12_000);
const distPath = path.join(__dirname, 'dist');
const aiRequestLog = new Map();

app.use(express.json({ limit: '1mb' }));

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const windowStart = now - AI_RATE_LIMIT_WINDOW_MS;
  const recent = (aiRequestLog.get(ip) || []).filter((stamp) => stamp > windowStart);
  if (recent.length >= AI_RATE_LIMIT_MAX) {
    aiRequestLog.set(ip, recent);
    return true;
  }
  recent.push(now);
  aiRequestLog.set(ip, recent);
  return false;
}

async function validateSupabaseToken(req) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, status: 503, message: 'Supabase auth validation is not configured on the server.' };
  }

  const authHeader = req.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Authentication is required for AI analysis.' };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      return { ok: false, status: 401, message: 'Your session is invalid or expired. Please sign in again.' };
    }

    return { ok: true, status: 200, message: '' };
  } catch {
    return { ok: false, status: 502, message: 'Unable to validate your session right now.' };
  }
}

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

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({
      error: 'Too many AI requests. Please wait a minute and try again.',
    });
    return;
  }

  const authCheck = await validateSupabaseToken(req);
  if (!authCheck.ok) {
    res.status(authCheck.status).json({ error: authCheck.message });
    return;
  }

  const summary = req.body?.summary;
  if (typeof summary !== 'string' || !summary.trim()) {
    res.status(400).json({ error: 'A sleep summary is required.' });
    return;
  }
  if (summary.length > SUMMARY_MAX_CHARS) {
    res.status(413).json({
      error: `Sleep summary is too large. Please keep it under ${SUMMARY_MAX_CHARS} characters.`,
    });
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
