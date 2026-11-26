/**
 * Centralized environment access. Keeps `process.env` lookups in one place and
 * makes it obvious which features degrade gracefully when a secret is missing.
 */

export const env = {
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me",

  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? "",
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ?? "",

  // Text generation. DeepSeek is the default; Anthropic is an explicit fallback.
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ?? "",
  DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL ?? "deepseek-flash",
  DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",

  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",

  // Live stakeholder capture. The browser never sees this key: the server
  // exchanges it for a short-lived token at /api/deepgram/token.
  DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY ?? "",
  DEEPGRAM_MODEL: process.env.DEEPGRAM_MODEL ?? "nova-3",
};

export const features = {
  /** GitHub OAuth is only usable when the OAuth app credentials are present. */
  github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
  deepseek: Boolean(env.DEEPSEEK_API_KEY),
  anthropic: Boolean(env.ANTHROPIC_API_KEY),
  /** Any text provider. Agents use this gate, not a specific vendor. */
  ai: Boolean(env.DEEPSEEK_API_KEY || env.ANTHROPIC_API_KEY),
  /** Live transcription of the stakeholder conversation. */
  deepgram: Boolean(env.DEEPGRAM_API_KEY),
};
