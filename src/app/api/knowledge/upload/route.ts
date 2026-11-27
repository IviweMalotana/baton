import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { transcribeAudio } from "@/lib/deepgram";
import { features } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 20 * 1024 * 1024;
const TEXT_EXT = /\.(txt|md|markdown|csv|json|html?|xml|ya?ml)$/i;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Upload a company document or voice memo.
 *
 * Audio is transcribed by Deepgram and only the transcript is stored. Text
 * files are read directly. A route handler is used instead of a server action
 * because audio files are larger than the action body limit.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid upload." }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is over 20 MB. Split it or upload the relevant section." },
      { status: 413 }
    );
  }

  const name = file.name;
  const lower = name.toLowerCase();
  const mime = file.type || "";
  const isAudio = mime.startsWith("audio/") || /\.(mp3|wav|m4a|webm|ogg|flac|aac)$/i.test(lower);
  const bytes = Buffer.from(await file.arrayBuffer());

  let content = "";
  let kind: "voice" | "document" = "document";

  try {
    if (isAudio) {
      if (!features.deepgram) {
        return NextResponse.json(
          { error: "Voice uploads need DEEPGRAM_API_KEY on this deployment." },
          { status: 503 }
        );
      }
      content = await transcribeAudio({
        bytes,
        mime: mime || "audio/mpeg",
        filename: name,
      });
      kind = "voice";
    } else if (TEXT_EXT.test(lower) || mime.startsWith("text/")) {
      const text = bytes.toString("utf8");
      content = /\.html?$/i.test(lower) ? stripHtml(text) : text;
      kind = "document";
    } else {
      return NextResponse.json(
        {
          error:
            "Upload audio, or a text file (TXT, MD, CSV, JSON, YAML, HTML). PDF and DOCX are not supported yet.",
        },
        { status: 415 }
      );
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  const clean = content.replace(/\r\n/g, "\n").trim();
  if (clean.length < 10) {
    return NextResponse.json(
      { error: "I could not read anything useful from that file." },
      { status: 422 }
    );
  }

  const titleInput = form.get("title");
  const title =
    typeof titleInput === "string" && titleInput.trim()
      ? titleInput.trim().slice(0, 160)
      : name.replace(/\.[^.]+$/, "").slice(0, 160);

  const item = await db.knowledgeItem.create({
    data: {
      companyId: user.companyId,
      createdById: user.id,
      kind,
      title,
      content: clean.slice(0, 30000),
      source: name.slice(0, 200),
    },
  });

  return NextResponse.json({
    ok: true,
    id: item.id,
    kind,
    chars: clean.length,
  });
}
