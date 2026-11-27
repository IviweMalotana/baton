"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import {
  answerDiscovery,
  addTranscript,
  askNextQuestion,
  confirmDiscovery,
  saveVoiceTranscript,
  type DiscoveryActionState,
} from "@/app/actions/discovery";

export interface DiscoveryTurnView {
  id: string;
  role: string;
  content: string;
  source: string;
  at: string;
}

interface DeepgramMessage {
  type?: string;
  is_final?: boolean;
  channel?: {
    alternatives?: {
      transcript?: string;
      words?: { speaker?: number }[];
    }[];
  };
}

export function DiscoveryPanel({
  requestId,
  state,
  brief,
  turns,
  deepgramEnabled,
  deepgramModel,
  modelLabel,
}: {
  requestId: string;
  state: string;
  brief: string;
  turns: DiscoveryTurnView[];
  deepgramEnabled: boolean;
  deepgramModel: string;
  modelLabel: string;
}) {
  const router = useRouter();
  const [listening, setListening] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [captured, setCaptured] = useState("");
  const [savingVoice, setSavingVoice] = useState(false);

  const audioRef = useRef<ReadableStreamDefaultController<Uint8Array> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finalRef = useRef("");
  const stoppingRef = useRef(false);

  const [answerState, answerAction] = useFormState<DiscoveryActionState, FormData>(
    answerDiscovery,
    undefined
  );
  const [pasteState, pasteAction] = useFormState<DiscoveryActionState, FormData>(
    addTranscript,
    undefined
  );
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (answerState?.saved && answerRef.current) answerRef.current.value = "";
  }, [answerState?.saved]);

  useEffect(() => {
    if (pasteState?.saved && pasteRef.current) pasteRef.current.value = "";
  }, [pasteState?.saved]);

  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop();
      } catch {
        /* already stopped */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        audioRef.current?.close();
      } catch {
        /* already closed */
      }
      abortRef.current?.abort();
    };
  }, []);

  const last = turns.length > 0 ? turns[turns.length - 1] : null;
  const awaitingAnswer = last?.role === "agent" && state !== "ready" && state !== "confirmed";
  const confirmed = state === "confirmed";

  function handleTranscript(data: DeepgramMessage) {
    if (data.type !== "Results") return;
    const alt = data.channel?.alternatives?.[0];
    const transcript = alt?.transcript?.trim();
    if (!transcript) return;

    if (data.is_final) {
      const speaker = alt?.words?.[0]?.speaker;
      const line = speaker === undefined ? transcript : `Speaker ${speaker + 1}: ${transcript}`;
      finalRef.current = `${finalRef.current} ${line}`.trim();
      setCaptured(finalRef.current);
      setInterim("");
    } else {
      setInterim(transcript);
    }
  }

  async function pump(response: Response) {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          try {
            handleTranscript(JSON.parse(line) as DeepgramMessage);
          } catch {
            /* keep-alive or partial line */
          }
        }
      }
    } catch (err) {
      if (!stoppingRef.current) {
        setVoiceError(`The Deepgram stream stopped: ${(err as Error).message}`);
      }
    } finally {
      setListening(false);
      setConnecting(false);
    }
  }

  async function startListening() {
    setVoiceError(null);
    setConnecting(true);
    finalRef.current = "";
    setCaptured("");
    setInterim("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
        (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)
      );
      const mime = preferred ?? "audio/webm";

      // A live body: MediaRecorder chunks are pushed as they arrive and the
      // server pipes them to Deepgram with the key attached.
      const audio = new ReadableStream<Uint8Array>({
        start(controller) {
          audioRef.current = controller;
        },
      });
      const abort = new AbortController();
      abortRef.current = abort;

      const init = {
        method: "POST",
        headers: { "content-type": mime },
        body: audio,
        signal: abort.signal,
        duplex: "half",
      } as RequestInit & { duplex: "half" };

      const response = await fetch("/api/deepgram/stream", init);
      if (!response.ok) {
        const detail = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(detail.error ?? `Deepgram returned ${response.status}.`);
      }

      const recorder = preferred
        ? new MediaRecorder(stream, { mimeType: preferred })
        : new MediaRecorder(stream);
      recorder.ondataavailable = async (event) => {
        if (event.data.size === 0) return;
        try {
          audioRef.current?.enqueue(new Uint8Array(await event.data.arrayBuffer()));
        } catch {
          /* controller closed while the last chunk drained */
        }
      };
      recorder.start(250);
      recorderRef.current = recorder;

      setListening(true);
      setConnecting(false);
      void pump(response);
    } catch (err) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      try {
        audioRef.current?.close();
      } catch {
        /* already closed */
      }
      audioRef.current = null;
      abortRef.current?.abort();
      abortRef.current = null;
      setVoiceError((err as Error).message);
      setConnecting(false);
      setListening(false);
    }
  }

  async function stopListening() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    try {
      recorderRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    // Closing the upload body lets Deepgram flush the final words before the
    // response ends.
    try {
      audioRef.current?.close();
    } catch {
      /* already closed */
    }
    audioRef.current = null;
    setListening(false);
    setInterim("");

    await new Promise((resolve) => setTimeout(resolve, 700));

    const text = finalRef.current.trim();
    if (text) {
      setSavingVoice(true);
      try {
        await saveVoiceTranscript(requestId, text);
        router.refresh();
      } catch (err) {
        setVoiceError(`Could not save the transcript: ${(err as Error).message}`);
      } finally {
        setSavingVoice(false);
      }
    }
    stoppingRef.current = false;
  }

  return (
    <div className="card">
      <div className="row" style={{ alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Discovery</h3>
        <div className="spacer" />
        <span className="badge status">
          {confirmed
            ? "Brief confirmed"
            : state === "ready"
              ? "Ready to confirm"
              : awaitingAnswer
                ? "Waiting on the stakeholder"
                : "Capturing"}
        </span>
      </div>
      <p className="small muted" style={{ marginTop: 6 }}>
        Baton listens to the stakeholder, asks one question at a time, and keeps
        going until every decision is confirmed. Answers are written by{" "}
        <span className="mono">{modelLabel}</span>; nothing is invented.
      </p>

      {voiceError && <div className="error">{voiceError}</div>}

      {confirmed && brief && (
        <div className="notice" style={{ borderLeftColor: "var(--accent)" }}>
          <strong>Confirmed brief</strong>
          <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{brief}</p>
        </div>
      )}

      {!confirmed && (
        <div className="card" style={{ background: "var(--surface-2, #f7f7f8)" }}>
          <div className="row" style={{ alignItems: "center" }}>
            <div>
              <strong>Stakeholder voice</strong>
              <div className="small muted">
                {deepgramEnabled
                  ? `Deepgram ${deepgramModel}, speaker-labelled, transcribed live.`
                  : "Deepgram is not configured on this deployment. You can still paste the notes below."}
              </div>
            </div>
            <div className="spacer" />
            {deepgramEnabled && (
              <button
                type="button"
                className={`btn ${listening ? "btn-danger" : "btn-primary"} btn-sm`}
                onClick={listening ? stopListening : startListening}
                disabled={connecting || savingVoice}
              >
                {connecting
                  ? "Connecting…"
                  : savingVoice
                    ? "Saving…"
                    : listening
                      ? "Stop and save"
                      : "Record stakeholder"}
              </button>
            )}
          </div>

          {(captured || interim) && (
            <div
              className="small"
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 8,
                background: "var(--background, #fff)",
                border: "1px solid var(--border, #e5e5e5)",
                minHeight: 48,
              }}
            >
              {captured || <span className="muted">Listening…</span>}
              {interim && <span className="muted"> {interim}</span>}
            </div>
          )}

          <details style={{ marginTop: 10 }}>
            <summary className="small muted">Paste notes or a transcript instead</summary>
            <form action={pasteAction} style={{ marginTop: 8 }}>
              <input type="hidden" name="requestId" value={requestId} />
              <textarea
                ref={pasteRef}
                name="text"
                placeholder="Paste the stakeholder's email, meeting notes or transcript…"
                style={{ width: "100%", minHeight: 90, marginTop: 4 }}
              />
              {pasteState?.error && <div className="error">{pasteState.error}</div>}
              <button className="btn btn-secondary btn-sm" type="submit" style={{ marginTop: 8 }}>
                Add to transcript
              </button>
            </form>
          </details>
        </div>
      )}

      {turns.length > 0 && (
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {turns.map((turn) => (
            <div
              key={turn.id}
              style={{
                justifySelf: turn.role === "agent" ? "start" : "end",
                maxWidth: "86%",
              }}
            >
              <div
                className="small muted"
                style={{ textAlign: turn.role === "agent" ? "left" : "right" }}
              >
                {turn.role === "agent" ? "Baton" : "Stakeholder"}
                {turn.source === "voice" ? " · voice" : ""}
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  background:
                    turn.role === "agent" ? "var(--surface-2, #f2f2f4)" : "var(--ink, #111)",
                  color: turn.role === "agent" ? "inherit" : "#fff",
                  whiteSpace: "pre-wrap",
                }}
              >
                {turn.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {!confirmed && (
        <div style={{ marginTop: 14 }}>
          {awaitingAnswer ? (
            <form action={answerAction}>
              <input type="hidden" name="requestId" value={requestId} />
              <label htmlFor={`answer-${requestId}`}>Stakeholder answer</label>
              <textarea
                id={`answer-${requestId}`}
                ref={answerRef}
                name="answer"
                placeholder="Type what the stakeholder said. Baton will ask the next question."
                style={{ width: "100%", minHeight: 80 }}
                required
              />
              {answerState?.error && <div className="error">{answerState.error}</div>}
              <button className="btn btn-primary" type="submit" style={{ marginTop: 8 }}>
                Send answer
              </button>
            </form>
          ) : state === "ready" ? (
            <form action={confirmDiscovery}>
              <input type="hidden" name="requestId" value={requestId} />
              <div className="notice" style={{ borderLeftColor: "var(--accent)" }}>
                Baton has no open questions. Confirm the brief and it will write the
                BRD and user stories from it.
              </div>
              <button className="btn btn-success" type="submit">
                Confirm brief and draft the BRD
              </button>
            </form>
          ) : (
            <form action={askNextQuestion}>
              <input type="hidden" name="requestId" value={requestId} />
              <p className="small muted">
                {turns.length === 0
                  ? "Record or paste what the stakeholder wants, then start the interview."
                  : "Add the stakeholder's answer above, or ask Baton for the next question."}
              </p>
              <button className="btn btn-primary" type="submit">
                {turns.length === 0 ? "Start the interview" : "Ask the next question"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
