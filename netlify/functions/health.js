export const handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      providerConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
    }),
  };
};
