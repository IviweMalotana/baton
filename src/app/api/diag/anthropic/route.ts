import { NextResponse } from "next/server";
import { getCurrentUser, can } from "@/lib/auth";
import { features } from "@/lib/env";
import { activeModel, activeProvider, completeText } from "@/lib/ai/text";

export const dynamic = "force-dynamic";

/**
 * Admin-only diagnostic: makes a tiny call on the same provider/transport the
 * agents use (raw node:https) and reports exactly what happens. Never returns
 * the API key; only the provider, model and error status/message.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can.manageCompany(user.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const base = {
    provider: activeProvider(),
    keyConfigured: features.ai,
    model: activeModel(),
    transport: "node:https (raw, no fetch)",
  };

  if (!features.ai) {
    return NextResponse.json({
      ...base,
      ok: false,
      reason: "Set DEEPSEEK_API_KEY (preferred) or ANTHROPIC_API_KEY",
    });
  }

  const started = Date.now();
  try {
    const reply = await completeText({
      system: "You are a connectivity check.",
      user: "Reply with the single word: pong",
      maxTokens: 200,
    });
    return NextResponse.json({
      ...base,
      ok: true,
      ms: Date.now() - started,
      reply: reply.slice(0, 60),
    });
  } catch (err) {
    const e = err as {
      name?: string;
      status?: number;
      message?: string;
      code?: string;
      cause?: { message?: string; code?: string };
    };
    return NextResponse.json({
      ...base,
      ok: false,
      ms: Date.now() - started,
      errorName: e?.name ?? null,
      status: e?.status ?? null,
      code: e?.code ?? null,
      message: String(e?.message ?? err).slice(0, 500),
      cause: e?.cause ? { message: e.cause.message, code: e.cause.code } : null,
    });
  }
}
