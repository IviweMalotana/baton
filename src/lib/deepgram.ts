import { env, features } from "./env";

interface DeepgramWord {
  word?: string;
  punctuated_word?: string;
  speaker?: number;
}

interface DeepgramResponse {
  results?: {
    channels?: {
      alternatives?: {
        transcript?: string;
        words?: DeepgramWord[];
      }[];
    }[];
  };
}

/**
 * Transcribe an uploaded voice note with Deepgram (prerecorded).
 *
 * Raw audio never lands in the database: we keep the transcript, speaker
 * labels included, and discard the file.
 */
export async function transcribeAudio(input: {
  bytes: Buffer;
  mime: string;
  filename?: string;
}): Promise<string> {
  if (!features.deepgram) {
    throw new Error("DEEPGRAM_API_KEY is not configured on this deployment.");
  }

  const params = new URLSearchParams({
    model: env.DEEPGRAM_MODEL,
    smart_format: "true",
    punctuate: "true",
    diarize: "true",
    utterances: "true",
  });

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
    method: "POST",
    headers: {
      authorization: `Token ${env.DEEPGRAM_API_KEY}`,
      "content-type": input.mime || "application/octet-stream",
    },
    body: new Uint8Array(input.bytes),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`Deepgram ${res.status}: ${detail}`);
  }

  const data = (await res.json()) as DeepgramResponse;
  const alt = data.results?.channels?.[0]?.alternatives?.[0];
  const words = alt?.words ?? [];
  const transcript = (alt?.transcript ?? "").trim();

  if (words.length === 0) return transcript;

  // Rebuild the transcript by speaker so a voice memo reads like a meeting.
  const lines: string[] = [];
  let speaker: number | undefined;
  let current: string[] = [];

  for (const word of words) {
    const text = word.punctuated_word ?? word.word ?? "";
    if (!text) continue;
    if (speaker === undefined) speaker = word.speaker ?? 0;
    if (word.speaker !== undefined && word.speaker !== speaker) {
      lines.push(`Speaker ${speaker + 1}: ${current.join(" ")}`);
      speaker = word.speaker;
      current = [];
    }
    current.push(text);
  }
  if (current.length > 0) lines.push(`Speaker ${(speaker ?? 0) + 1}: ${current.join(" ")}`);

  return lines.join("\n").trim() || transcript;
}
