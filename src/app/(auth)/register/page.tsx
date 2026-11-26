"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { registerCompany, enterDemo, type ActionState } from "@/app/actions/auth";
import { APP_NAME } from "@/lib/brand";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending} style={{ marginTop: 16 }}>
      {pending ? "Creating…" : "Create workspace"}
    </button>
  );
}

export default function RegisterPage() {
  const [state, action] = useFormState<ActionState, FormData>(registerCompany, undefined);

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <Link href="/" className="auth-brand">
          <span aria-hidden>⟡</span> {APP_NAME}
        </Link>

        <div className="auth-heading">
          <h1>Create your workspace</h1>
          <p>
            You will be the owner. Invite collaborators, BAs, developers and
            stakeholders once you are in.
          </p>
        </div>

        <div className="auth-card">
          <form action={action}>
            <label htmlFor="companyName">Company name</label>
            <input id="companyName" name="companyName" placeholder="Acme Inc." required />

            <label htmlFor="name">Your name</label>
            <input id="name" name="name" placeholder="Ada Lovelace" autoComplete="name" required />

            <label htmlFor="email">Work email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />

            {state?.error && <div className="error">{state.error}</div>}
            <SubmitButton />
          </form>

          <div className="auth-divider">
            <span>just looking?</span>
          </div>

          <form action={enterDemo}>
            <button className="btn secondary auth-demo" type="submit">
              Open the demo instead
            </button>
          </form>
        </div>

        <p className="auth-switch">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
