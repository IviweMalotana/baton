import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { env, features } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Mint a short-lived Deepgram token for the browser.
 *
 * The long-lived API key never leaves the server. The browser uses the token
 * as a WebSocket subprotocol (`["token", accessToken]`) to stream microphone
 * audio for live stakeholder transcription.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!features.deepgram) {
    return NextResponse.json(
      { error: "DEEPGRAM_API_KEY is not configured on this deployment." },
      { status: 503 }
    );
  }

  try {
    const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        authorization: `Token ${env.DEEPGRAM_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ttl_seconds: 3600 }),
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return NextResponse.json(
        { error: `Deepgram token request failed (${res.status}).`, detail },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      return NextResponse.json({ error: "Deepgram returned no token." }, { status: 502 });
    }

    return NextResponse.json({
      token: data.access_token,
      expiresIn: data.expires_in ?? 3600,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach Deepgram: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
