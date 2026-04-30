const DEFAULT_ALLOWED_ORIGINS = [
  'https://sleepaa.netlify.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const ORIGIN_ALLOWLIST = ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : DEFAULT_ALLOWED_ORIGINS;
const AI_RATE_LIMIT_WINDOW_MS = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 60_000);
const AI_RATE_LIMIT_MAX = Number(process.env.AI_RATE_LIMIT_MAX || 12);
const SUMMARY_MAX_CHARS = Number(process.env.AI_SUMMARY_MAX_CHARS || 12_000);
const requestLog = new Map();

function createCorsHeaders(origin) {
  const allowOrigin = origin && ORIGIN_ALLOWLIST.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function getClientIp(event) {
  const fromNetlify = event.headers['x-nf-client-connection-ip'];
  if (fromNetlify) return fromNetlify;
  const forwarded = event.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const windowStart = now - AI_RATE_LIMIT_WINDOW_MS;
  const recent = (requestLog.get(ip) || []).filter((stamp) => stamp > windowStart);
  if (recent.length >= AI_RATE_LIMIT_MAX) {
    requestLog.set(ip, recent);
    return true;
  }
  recent.push(now);
  requestLog.set(ip, recent);
  return false;
}

async function validateSupabaseToken(authorizationHeader) {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, statusCode: 503, error: 'Supabase auth validation is not configured on the server.' };
  }

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return { ok: false, statusCode: 401, error: 'Authentication is required for AI analysis.' };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: authorizationHeader,
      },
    });

    if (!response.ok) {
      return { ok: false, statusCode: 401, error: 'Your session is invalid or expired. Please sign in again.' };
    }

    return { ok: true };
  } catch {
    return { ok: false, statusCode: 502, error: 'Unable to validate your session right now.' };
  }
}

export const handler = async (event) => {
  const origin = event.headers.origin || '';
  const corsHeaders = createCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    if (origin && !ORIGIN_ALLOWLIST.includes(origin)) {
      return { statusCode: 403, headers: corsHeaders, body: '' };
    }
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  if (origin && !ORIGIN_ALLOWLIST.includes(origin)) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Origin is not allowed.' }),
    };
  }

  const ip = getClientIp(event);
  if (isRateLimited(ip)) {
    return {
      statusCode: 429,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Too many AI requests. Please wait a minute and try again.' }),
    };
  }

  const authCheck = await validateSupabaseToken(event.headers.authorization || '');
  if (!authCheck.ok) {
    return {
      statusCode: authCheck.statusCode,
      headers: corsHeaders,
      body: JSON.stringify({ error: authCheck.error }),
    };
  }

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!DEEPSEEK_API_KEY) {
    return {
      statusCode: 503,
      headers: corsHeaders,
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
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid JSON payload. A sleep summary is required.' }),
    };
  }

  const summary = body?.summary;
  if (typeof summary !== 'string' || !summary.trim()) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'A sleep summary is required.' }),
    };
  }
  if (summary.length > SUMMARY_MAX_CHARS) {
    return {
      statusCode: 413,
      headers: corsHeaders,
      body: JSON.stringify({
        error: `Sleep summary is too large. Please keep it under ${SUMMARY_MAX_CHARS} characters.`,
      }),
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
        headers: corsHeaders,
        body: JSON.stringify({
          error: data?.error?.message || `DeepSeek request failed with status ${response.status}`,
        }),
      };
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'DeepSeek returned an empty response.' }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Unable to reach DeepSeek right now.',
      }),
    };
  }
};
