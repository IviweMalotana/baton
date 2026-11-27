import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { env, features } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Server-side audio bridge to Deepgram.
 *
 * The browser streams microphone chunks here; this route pipes them to
 * Deepgram's streaming endpoint with the long-lived key attached. The key never
 * reaches the browser, and no short-lived grant is required (restricted
 * Deepgram keys cannot mint one).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!features.deepgram) {
    return NextResponse.json(
      { error: "DEEPGRAM_API_KEY is not configured on this deployment." },
      { status: 503 }
    );
  }
  if (!req.body) {
    return NextResponse.json({ error: "No audio stream in the request." }, { status: 400 });
  }

  const params = new URLSearchParams({
    model: env.DEEPGRAM_MODEL,
    language: "en",
    smart_format: "true",
    punctuate: "true",
    diarize: "true",
    interim_results: "true",
    utterance_end_ms: "1200",
    vad_events: "true",
  });

  const contentType = req.headers.get("content-type") ?? "audio/webm";
  const init = {
    method: "POST",
    headers: {
      authorization: `Token ${env.DEEPGRAM_API_KEY}`,
      "content-type": contentType,
    },
    body: req.body,
    cache: "no-store",
    // Required by Node's fetch when the request body is a stream.
    duplex: "half",
  } as RequestInit & { duplex: "half" };

  try {
    const upstream = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, init);
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: `Deepgram ${upstream.status}`, detail: detail.slice(0, 300) },
        { status: 502 }
      );
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
        "x-accel-buffering": "no",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach Deepgram: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
