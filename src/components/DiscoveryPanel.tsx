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

  const wsRef = useRef<WebSocket | null>(null);
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
        wsRef.current?.close();
      } catch {
        /* already closed */
      }
    };
  }, []);

  const last = turns.length > 0 ? turns[turns.length - 1] : null;
  const awaitingAnswer = last?.role === "agent" && state !== "ready" && state !== "confirmed";
  const confirmed = state === "confirmed";

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

      const res = await fetch("/api/deepgram/token", { method: "POST" });
      const body = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !body.token) {
        throw new Error(body.error ?? "Deepgram is not available.");
      }

      const params = new URLSearchParams({
        model: deepgramModel,
        language: "en",
        smart_format: "true",
        punctuate: "true",
        diarize: "true",
        interim_results: "true",
        utterance_end_ms: "1200",
        vad_events: "true",
      });
      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params.toString()}`, [
        "token",
        body.token,
      ]);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        const preferred = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
        ].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
        const recorder = preferred
          ? new MediaRecorder(stream, { mimeType: preferred })
          : new MediaRecorder(stream);

        recorder.ondataavailable = async (event) => {
          if (event.data.size === 0 || ws.readyState !== WebSocket.OPEN) return;
          ws.send(await event.data.arrayBuffer());
        };
        recorder.start(250);
        recorderRef.current = recorder;
        setListening(true);
        setConnecting(false);
      };

      ws.onmessage = (event) => {
        let data: DeepgramMessage;
        try {
          data = JSON.parse(String(event.data)) as DeepgramMessage;
        } catch {
          return;
        }
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
      };

      ws.onerror = () => {
        setVoiceError("The Deepgram connection failed. Check the key and try again.");
        setListening(false);
        setConnecting(false);
      };

      ws.onclose = () => {
        setListening(false);
        setConnecting(false);
      };
    } catch (err) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      wsRef.current = null;
      setVoiceError((err as Error).message);
      setConnecting(false);
      setListening(false);
    }
  }

  async function stopListening() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const ws = wsRef.current;
    const text = finalRef.current.trim();

    try {
      recorderRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "CloseStream" }));
      }
    } catch {
      /* socket already closing */
    }
    try {
      ws?.close();
    } catch {
      /* already closed */
    }
    wsRef.current = null;
    setListening(false);
    setConnecting(false);
    setInterim("");

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

      {/* Confirmed brief */}
      {confirmed && brief && (
        <div className="notice" style={{ borderLeftColor: "var(--accent)" }}>
          <strong>Confirmed brief</strong>
          <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{brief}</p>
        </div>
      )}

      {/* Live capture */}
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

      {/* Interview */}
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
              <div className="small muted" style={{ textAlign: turn.role === "agent" ? "left" : "right" }}>
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

      {/* Next step */}
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
