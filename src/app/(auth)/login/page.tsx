"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { login, enterDemo, type ActionState } from "@/app/actions/auth";
import { APP_NAME } from "@/lib/brand";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending} style={{ marginTop: 16 }}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginPage() {
  const [state, action] = useFormState<ActionState, FormData>(login, undefined);

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <Link href="/" className="auth-brand">
          <span aria-hidden>⟡</span> {APP_NAME}
        </Link>

        <div className="auth-heading">
          <h1>Sign in</h1>
          <p>Pick up the thread where you left it.</p>
        </div>

        <div className="auth-card">
          <form action={action}>
            <label htmlFor="email">Email</label>
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
              autoComplete="current-password"
              required
            />

            {state?.error && <div className="error">{state.error}</div>}
            <SubmitButton />
          </form>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <form action={enterDemo}>
            <button className="btn secondary auth-demo" type="submit">
              Explore the demo workspace
            </button>
          </form>
          <p className="auth-hint">
            The demo signs you in as the seeded BA. No setup, no card.
          </p>
        </div>

        <p className="auth-switch">
          New here? <Link href="/register">Create a company</Link>
        </p>
      </div>
    </div>
  );
}
