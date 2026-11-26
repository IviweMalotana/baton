/**
 * Discovery agent: the senior-BA interview.
 *
 * The pipeline used to jump from a free-text request straight to a BRD. This
 * agent makes Baton behave like a real BA: it listens to the stakeholder
 * (Deepgram live transcript or typed notes), asks one question at a time, and
 * only marks the brief ready when every decision it would otherwise have to
 * assume has been answered.
 *
 * DeepSeek answers by default (see lib/ai/text.ts). With no key, a
 * deterministic interviewer still walks the six dimensions so the flow is
 * usable offline.
 */

import { features } from "../env";
import { runAgentJson } from "../ai/providers";
import { activeModel } from "../ai/text";

export interface DiscoveryTurnInput {
  role: "agent" | "stakeholder" | "system" | string;
  content: string;
}

export interface DiscoveryDecision {
  status: "question" | "ready";
  question: string | null;
  reason: string | null;
  summary: string;
  openItems: string[];
  model: string;
}

export interface DiscoveryInput {
  title: string;
  description: string;
  transcript: string;
  turns: DiscoveryTurnInput[];
  routing?: string | null;
}

const SYSTEM = `You are Baton, a senior business analyst interviewing a stakeholder about a change.

Your job is to turn a rough request into a brief that is confirmed, not assumed.

Rules:
- Ask ONE question at a time. Never stack two questions in one turn.
- Ask only what you cannot infer from the request or the answers so far, and only what would change what gets built.
- Prefer decisions: who the user is, the business outcome, what is in and out of scope, what happens on empty/error/permission paths, the data and rules involved, and how success is measured.
- Use the stakeholder's own words. If an answer is vague ("fast", "simple", "better"), ask for the number, the example or the boundary.
- If an answer contradicts an earlier answer, ask which one is correct instead of guessing.
- Never invent a requirement, number, date, price or constraint.
- Treat "I don't know" as an answer: ask who would know or what the safe default is.
- Mark the brief ready only when all six dimensions are answered and consistent: users, business outcome, scope, states and edge cases, data/rules/permissions, success measure.
- A question must be under 30 words. The summary must be under 180 words.

Reply with JSON only, exactly this shape:
{
  "status": "question" | "ready",
  "question": string | null,
  "reason": string | null,
  "summary": string,
  "openItems": string[]
}

When status is "ready", "question" and "reason" are null and "summary" is the confirmed brief the BRD will be written from.
When status is "question", "summary" is your current understanding (it may be incomplete) and "openItems" lists what is still unknown.`;

export async function nextDiscoveryStep(input: DiscoveryInput): Promise<DiscoveryDecision> {
  const stakeholderTurns = input.turns.filter((t) => t.role === "stakeholder").length;

  if (!features.ai) {
    return fallback(input, stakeholderTurns);
  }

  const conversation = input.turns
    .filter((t) => t.role !== "system")
    .map((t) => `${t.role === "agent" ? "Baton" : "Stakeholder"}: ${t.content}`)
    .join("\n")
    .slice(-9000);

  const user = `Request title: ${input.title}

Original request:
"""
${input.description.slice(0, 4000)}
"""

Stakeholder transcript (verbatim, may be empty):
"""
${(input.transcript || "").slice(-6000)}
"""

Interview so far:
"""
${conversation || "(no questions asked yet)"}
"""

Stakeholder answers recorded: ${stakeholderTurns}

Decide the next step.`;

  try {
    const parsed = await runAgentJson<Partial<DiscoveryDecision>>({
      role: "ba",
      routing: input.routing ?? null,
      req: { system: SYSTEM, user, maxTokens: 900 },
    });

    const status = parsed.status === "ready" ? "ready" : "question";
    const question = typeof parsed.question === "string" ? parsed.question.trim() : null;
    const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : null;
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const openItems = Array.isArray(parsed.openItems)
      ? parsed.openItems.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 8)
      : [];

    // A model must not close the interview before it has heard the stakeholder,
    // and it must not repeat the question already on the table.
    if (status === "ready" && stakeholderTurns < 2) {
      return { ...fallback(input, stakeholderTurns), summary: summary || fallbackSummary(input) };
    }
    if (status === "question" && !question) {
      return { ...fallback(input, stakeholderTurns), summary: summary || fallbackSummary(input) };
    }
    if (status === "question" && question && isRepeat(question, input.turns)) {
      return { ...fallback(input, stakeholderTurns), summary: summary || fallbackSummary(input) };
    }

    return {
      status,
      question: status === "question" ? question : null,
      reason: status === "question" ? reason : null,
      summary: summary || fallbackSummary(input),
      openItems,
      model: activeModel(),
    };
  } catch {
    return fallback(input, stakeholderTurns);
  }
}

function isRepeat(question: string, turns: DiscoveryTurnInput[]): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const asked = turns.filter((t) => t.role === "agent").map((t) => norm(t.content));
  return asked.includes(norm(question));
}

interface Dimension {
  key: string;
  question: string;
  reason: string;
  keywords: string[];
}

const DIMENSIONS: Dimension[] = [
  {
    key: "users",
    question: "Who is the primary person using this, and what are they doing today?",
    reason: "The BRD needs one named user and the current workaround.",
    keywords: ["who", "role", "team", "customer", "user", "staff", "admin", "finance", "manager"],
  },
  {
    key: "outcome",
    question: "What business outcome should change, and how would you notice it worked?",
    reason: "A change without a measurable outcome cannot be accepted or rejected.",
    keywords: ["outcome", "why", "goal", "save", "reduce", "faster", "revenue", "cost", "because"],
  },
  {
    key: "scope",
    question: "What is explicitly in scope for this change, and what should not change?",
    reason: "Scope boundaries stop the build growing beyond the request.",
    keywords: ["scope", "only", "include", "exclude", "not change", "keep", "also"],
  },
  {
    key: "states",
    question: "What should happen on the awkward paths: no data, invalid input, or no permission?",
    reason: "Error and empty states belong in the requirements, not the implementation.",
    keywords: ["error", "empty", "invalid", "permission", "denied", "offline", "fail", "missing"],
  },
  {
    key: "rules",
    question: "Which data, calculations or permissions decide what this shows or allows?",
    reason: "The rules are where a plausible implementation usually goes wrong.",
    keywords: ["data", "field", "price", "vat", "calculate", "rule", "access", "permission", "status"],
  },
  {
    key: "success",
    question: "How will you confirm this is correct before it goes live?",
    reason: "The acceptance check needs a concrete, observable success condition.",
    keywords: ["test", "confirm", "success", "measure", "kpi", "number", "percent", "minutes", "days"],
  },
];

function corpus(input: DiscoveryInput): string {
  return [
    input.description,
    input.transcript,
    ...input.turns.filter((t) => t.role === "stakeholder").map((t) => t.content),
  ]
    .join(" ")
    .toLowerCase();
}

function fallback(input: DiscoveryInput, stakeholderTurns: number): DiscoveryDecision {
  const text = corpus(input);
  const missing = DIMENSIONS.filter((d) => !d.keywords.some((k) => text.includes(k)));

  if (missing.length === 0 || stakeholderTurns >= DIMENSIONS.length) {
    return {
      status: "ready",
      question: null,
      reason: null,
      summary: fallbackSummary(input),
      openItems: [],
      model: "fallback",
    };
  }

  const next = missing[0];
  return {
    status: "question",
    question: next.question,
    reason: next.reason,
    summary: fallbackSummary(input),
    openItems: missing.map((d) => d.key),
    model: "fallback",
  };
}

function fallbackSummary(input: DiscoveryInput): string {
  const answers = input.turns.filter((t) => t.role === "stakeholder").map((t) => t.content.trim());
  const parts = [
    input.description.trim(),
    input.transcript.trim(),
    ...answers,
  ].filter(Boolean);
  return parts.join("\n\n").slice(0, 4000);
}
