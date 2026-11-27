"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { registerCompany, enterDemo, type ActionState } from "@/app/actions/auth";
import { APP_NAME } from "@/lib/brand";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create account"}
    </button>
  );
}

export function RegisterForm({ initialType }: { initialType: "ba" | "company" }) {
  const [type, setType] = useState<"ba" | "company">(initialType);
  const [state, action] = useFormState<ActionState, FormData>(registerCompany, undefined);

  return (
    <>
      <div className="auth-heading">
        <h1>Create an account</h1>
        <p>One BA, or a company that needs several. You will be the owner.</p>
      </div>

      <div className="auth-card">
        <form action={action}>
          <div className="account-toggle" role="radiogroup" aria-label="Account type">
            <label>
              <input
                type="radio"
                name="accountType"
                value="ba"
                checked={type === "ba"}
                onChange={() => setType("ba")}
              />
              I am a BA
            </label>
            <label>
              <input
                type="radio"
                name="accountType"
                value="company"
                checked={type === "company"}
                onChange={() => setType("company")}
              />
              I am hiring
            </label>
          </div>

          {type === "company" && (
            <>
              <label htmlFor="companyName">Company name</label>
              <input
                id="companyName"
                name="companyName"
                placeholder="Acme Inc."
                required
              />
            </>
          )}

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
            placeholder="At least 10 characters"
            autoComplete="new-password"
            minLength={10}
            required
          />

          {state?.error && <div className="error" style={{ marginTop: 14 }}>{state.error}</div>}
          <SubmitButton />
        </form>

        <div className="auth-divider">
          <span>just looking?</span>
        </div>

        <form action={enterDemo}>
          <button className="btn auth-demo" type="submit">
            Open the demo instead
          </button>
        </form>
      </div>

      <p className="auth-switch">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </>
  );
}

export function AuthBrand() {
  return (
    <Link href="/" className="brand auth-brand" aria-label={`${APP_NAME} home`}>
      <span className="brand-dot" aria-hidden />
      {APP_NAME}
    </Link>
  );
}
