import https from "https";
import { env, features } from "../env";

/**
 * The single text-generation choke point for Baton.
 *
 * DeepSeek is the default provider: it is the cheapest model that holds a
 * long BA conversation, and the estate already uses it. Anthropic stays as an
 * explicit fallback for a deployment that only has an Anthropic key.
 *
 * Everything here goes over raw node:https. Next.js patches global fetch, and
 * the patched keep-alive pool produced ERR_STREAM_PREMATURE_CLOSE on the
 * production host. A fresh TLS connection per request avoids that layer.
 */

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 120_000;

export type ActiveProvider = "deepseek" | "anthropic" | "none";

export function activeProvider(): ActiveProvider {
  if (features.deepseek) return "deepseek";
  if (features.anthropic) return "anthropic";
  return "none";
}

/** Truthy when any text provider is configured. Named for call-site clarity. */
export function aiReady(): boolean {
  return activeProvider() !== "none";
}

/** The model id currently answering, for the UI and audit fields. */
export function activeModel(): string {
  const provider = activeProvider();
  if (provider === "deepseek") return env.DEEPSEEK_MODEL;
  if (provider === "anthropic") return env.ANTHROPIC_MODEL;
  return "fallback";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function postJson(
  host: string,
  path: string,
  headers: Record<string, string>,
  payload: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host,
        path,
        method: "POST",
        agent: false,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
          ...headers,
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c: string) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error("AI request timed out")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function isRetryable(status: number, message: string): boolean {
  if (status === 429 || status >= 500) return true;
  const m = message.toLowerCase();
  return (
    m.includes("premature close") ||
    m.includes("socket hang up") ||
    m.includes("timed out") ||
    m.includes("econnreset") ||
    m.includes("epipe")
  );
}

async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await run();
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_ATTEMPTS) break;
      const message = String((err as Error)?.message ?? err);
      if (!isRetryable(0, message)) break;
      await sleep(500 * attempt);
    }
  }
  throw lastErr;
}

async function deepSeekText(args: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  if (!features.deepseek) throw new Error("DEEPSEEK_API_KEY not configured");
  const base = env.DEEPSEEK_BASE_URL.replace(/\/$/, "").replace(/^https?:\/\//, "");
  const payload = JSON.stringify({
    model: env.DEEPSEEK_MODEL,
    temperature: 0.2,
    max_tokens: args.maxTokens ?? 2000,
    stream: false,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
  });

  return withRetry(async () => {
    const res = await postJson(
      base,
      "/chat/completions",
      { authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
      payload
    );
    if (res.status !== 200) {
      const err = new Error(`DeepSeek ${res.status}: ${res.body.slice(0, 300)}`);
      (err as { retryable?: boolean }).retryable = isRetryable(res.status, res.body);
      throw err;
    }
    const data = JSON.parse(res.body) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    };
    const choice = data.choices?.[0];
    const text = (choice?.message?.content ?? "").trim();
    if (!text) {
      throw new Error(
        `DeepSeek returned an empty answer (finish: ${choice?.finish_reason ?? "unknown"}).`
      );
    }
    return text;
  });
}

async function anthropicText(args: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  if (!features.anthropic) throw new Error("ANTHROPIC_API_KEY not configured");
  const payload = JSON.stringify({
    model: env.ANTHROPIC_MODEL,
    max_tokens: args.maxTokens ?? 2000,
    ...(args.system ? { system: args.system } : {}),
    messages: [{ role: "user", content: args.user }],
  });

  return withRetry(async () => {
    const res = await postJson(
      "api.anthropic.com",
      "/v1/messages",
      {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      payload
    );
    if (res.status !== 200) {
      const err = new Error(`Anthropic ${res.status}: ${res.body.slice(0, 300)}`);
      (err as { retryable?: boolean }).retryable = isRetryable(res.status, res.body);
      throw err;
    }
    const data = JSON.parse(res.body) as {
      content?: { type: string; text?: string }[];
    };
    return (data.content ?? [])
      .map((c) => (c.type === "text" ? c.text ?? "" : ""))
      .join("")
      .trim();
  });
}

/** Run a completion on one explicit provider, ignoring the default. */
export async function completeOn(
  provider: Exclude<ActiveProvider, "none">,
  args: { system: string; user: string; maxTokens?: number }
): Promise<string> {
  if (provider === "deepseek") return deepSeekText(args);
  return anthropicText(args);
}

/** Full text of one completion, on whichever provider is configured. */
export async function completeText(args: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const provider = activeProvider();
  if (provider === "deepseek") {
    try {
      const text = await deepSeekText(args);
      if (text) return text;
    } catch (err) {
      if (!features.anthropic) throw err;
      // Fall through to Anthropic only when it can actually answer.
    }
  }
  if (features.anthropic) return anthropicText(args);
  throw new Error("No AI provider configured");
}

/**
 * Ask for one JSON object. The prompt tells the model to reply with JSON only;
 * we still extract the first {...} block defensively.
 */
export async function completeJson(
  args: { system: string; user: string; maxTokens?: number }
): Promise<Record<string, unknown>> {
  const text = await completeText(args);
  return extractJson(text);
}

function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in model response");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
