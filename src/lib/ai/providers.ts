/**
 * AI provider abstraction.
 *
 * Agents ask for a completion by role; this module resolves the role to a
 * `provider:model` (from the company's routing config) and runs it. DeepSeek is
 * the default so a fresh deployment needs one key, not three.
 *
 * To add a provider: implement the adapter here and add its key to env.ts.
 * Agents never import a vendor client directly.
 */

import {
  activeModel,
  activeProvider,
  completeOn,
  type ActiveProvider,
} from "./text";
import { env, features } from "../env";
import type { AgentRole } from "../domain";

export type ProviderName = "deepseek" | "anthropic" | "openai" | "google";

export interface AiCompletionRequest {
  system?: string;
  user: string;
  maxTokens?: number;
  // When set, the provider is asked to return a single JSON object matching
  // this (free-form) description. The adapter coerces to JSON.
  jsonShape?: string;
}

export interface AiProvider {
  name: ProviderName;
  ready: boolean;
  completeText(req: AiCompletionRequest, model: string): Promise<string>;
  completeJson<T>(req: AiCompletionRequest, model: string): Promise<T>;
}

function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model response");
  return JSON.parse(candidate.slice(start, end + 1));
}

function adapter(name: "deepseek" | "anthropic", ready: boolean): AiProvider {
  return {
    name,
    ready,
    async completeText(req) {
      return completeOn(name, {
        system: req.system ?? "",
        user: req.user,
        maxTokens: req.maxTokens,
      });
    },
    async completeJson<T>(req: AiCompletionRequest): Promise<T> {
      const text = await completeOn(name, {
        system: req.system ?? "",
        user: req.user,
        maxTokens: req.maxTokens,
      });
      return extractJson(text) as T;
    },
  };
}

const stub = (name: ProviderName): AiProvider => ({
  name,
  ready: false,
  async completeText() {
    throw new Error(
      `${name} provider is declared but no adapter is implemented yet. See src/lib/ai/providers.ts.`
    );
  },
  async completeJson() {
    throw new Error(
      `${name} provider is declared but no adapter is implemented yet. See src/lib/ai/providers.ts.`
    );
  },
});

const providers: Record<ProviderName, AiProvider> = {
  deepseek: adapter("deepseek", features.deepseek),
  anthropic: adapter("anthropic", features.anthropic),
  openai: stub("openai"),
  google: stub("google"),
};

export function getProvider(name: ProviderName): AiProvider {
  return providers[name];
}

export interface Resolved {
  provider: ProviderName;
  model: string;
}

/** The default provider:model when the company sets no routing for a role. */
export function defaultRoute(): Resolved {
  const provider = activeProvider();
  if (provider === "deepseek") {
    return { provider: "deepseek", model: env.DEEPSEEK_MODEL };
  }
  if (provider === "anthropic") {
    return { provider: "anthropic", model: env.ANTHROPIC_MODEL };
  }
  return { provider: "deepseek", model: env.DEEPSEEK_MODEL };
}

/**
 * Resolve a `provider:model` string from the company's routing config. A role
 * with no explicit route uses the deployment default (DeepSeek when keyed).
 */
export function pickModel(
  role: AgentRole,
  routingJson: string | null | undefined
): Resolved {
  const routing = parseRouting(routingJson);
  const raw = routing[role];
  if (raw && raw.includes(":")) {
    const [provider, ...rest] = raw.split(":");
    const model = rest.join(":");
    if (isProviderName(provider) && model) {
      // Do not route to a stub or an unkeyed provider: fall back to the default.
      if (providers[provider].ready) return { provider, model };
    }
  }
  return defaultRoute();
}

function parseRouting(json: string | null | undefined): Partial<Record<AgentRole, string>> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function isProviderName(name: string): name is ProviderName {
  return name === "deepseek" || name === "anthropic" || name === "openai" || name === "google";
}

/** Agent entry point. Chooses the provider+model for `role` and runs JSON. */
export async function runAgentJson<T>(opts: {
  role: AgentRole;
  routing: string | null | undefined;
  req: AiCompletionRequest;
}): Promise<T> {
  const picked = pickModel(opts.role, opts.routing);
  return getProvider(picked.provider).completeJson<T>(opts.req, picked.model);
}

/** Agent entry point for prose. */
export async function runAgentText(opts: {
  role: AgentRole;
  routing: string | null | undefined;
  req: AiCompletionRequest;
}): Promise<string> {
  const picked = pickModel(opts.role, opts.routing);
  return getProvider(picked.provider).completeText(opts.req, picked.model);
}

export { activeModel, activeProvider, aiReady } from "./text";
export type { ActiveProvider };
