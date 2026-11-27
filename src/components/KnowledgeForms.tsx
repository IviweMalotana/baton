"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  addKnowledgeNote,
  saveCompanyProfile,
  type KnowledgeState,
} from "@/app/actions/knowledge";

function SaveButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function CompanyProfileForm({ about, voice }: { about: string; voice: string }) {
  const [state, action] = useFormState<KnowledgeState, FormData>(
    saveCompanyProfile,
    undefined
  );

  return (
    <form action={action} className="panel">
      <div className="panel-head">
        <div>
          <h2>Company profile</h2>
          <p className="muted small">Read before Baton asks the first question.</p>
        </div>
        {state?.saved && <span className="badge ok">Saved</span>}
      </div>
      <div className="panel-body stack">
        <label className="field">
          <span>What the company does</span>
          <textarea
            name="about"
            defaultValue={about}
            rows={4}
            placeholder="What you sell, who buys it, and the parts of the business that change most often."
          />
        </label>
        <label className="field">
          <span>How the company speaks</span>
          <textarea
            name="voice"
            defaultValue={voice}
            rows={3}
            placeholder="Terms you use, words you avoid, the tone a stakeholder expects."
          />
        </label>
        <div>
          <SaveButton label="Save profile" pendingLabel="Saving…" />
        </div>
      </div>
    </form>
  );
}

export function AddNoteForm() {
  const [state, action] = useFormState<KnowledgeState, FormData>(
    addKnowledgeNote,
    undefined
  );
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.saved) ref.current?.reset();
  }, [state?.saved]);

  return (
    <form action={action} ref={ref} className="panel">
      <div className="panel-head">
        <div>
          <h2>Add a note</h2>
          <p className="muted small">A decision, a glossary, a constraint.</p>
        </div>
      </div>
      <div className="panel-body stack">
        <label className="field">
          <span>Title</span>
          <input name="title" placeholder="How refunds work" required />
        </label>
        <label className="field">
          <span>Note</span>
          <textarea
            name="content"
            rows={4}
            placeholder="Write it the way you would explain it to a new BA."
            required
          />
        </label>
        {state?.error && <p className="error-text">{state.error}</p>}
        <div>
          <SaveButton label="Add note" pendingLabel="Adding…" />
        </div>
      </div>
    </form>
  );
}

export function UploadKnowledge({ deepgramEnabled }: { deepgramEnabled: boolean }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setOk(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a file first.");
      return;
    }

    setUploading(true);
    try {
      const res = await fetch("/api/knowledge/upload", { method: "POST", body: data });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        kind?: string;
        chars?: number;
      };
      if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status}).`);
      setOk(
        body.kind === "voice"
          ? "Voice memo transcribed and saved."
          : `Saved (${body.chars ?? 0} characters).`
      );
      form.reset();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="panel">
      <div className="panel-head">
        <div>
          <h2>Upload</h2>
          <p className="muted small">
            {deepgramEnabled
              ? "A voice memo is transcribed by Deepgram. Audio is not stored."
              : "Voice uploads need a Deepgram key. Text files work now."}
          </p>
        </div>
      </div>
      <div className="panel-body stack">
        <label className="field">
          <span>File</span>
          <input
            type="file"
            name="file"
            accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.txt,.md,.csv,.json,.yaml,.yml,.html"
          />
          <span className="muted small">
            Up to 20 MB. Audio, TXT, MD, CSV, JSON, YAML or HTML.
          </span>
        </label>
        <label className="field">
          <span>Title (optional)</span>
          <input name="title" placeholder="Sales call, 12 March" />
        </label>
        {error && <p className="error-text">{error}</p>}
        {ok && <p className="ok-text">{ok}</p>}
        <div>
          <button className="btn" type="submit" disabled={uploading}>
            {uploading ? "Reading…" : "Upload"}
          </button>
        </div>
      </div>
    </form>
  );
}
