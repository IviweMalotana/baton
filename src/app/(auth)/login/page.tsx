"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { login, enterDemo, type ActionState } from "@/app/actions/auth";
import { AuthBrand } from "@/components/RegisterForm";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginPage() {
  const [state, action] = useFormState<ActionState, FormData>(login, undefined);

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <AuthBrand />

        <div className="auth-heading">
          <h1>Sign in</h1>
          <p>Pick up the conversation where you left it.</p>
        </div>

        <div className="auth-card">
          <form action={action}>
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
              autoComplete="current-password"
              required
            />

            {state?.error && <div className="error" style={{ marginTop: 14 }}>{state.error}</div>}
            <SubmitButton />
          </form>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <form action={enterDemo}>
            <button className="btn auth-demo" type="submit">
              Open the demo workspace
            </button>
          </form>
        </div>

        <p className="auth-switch">
          New here? <Link href="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
