import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { enterDemo } from "@/app/actions/auth";
import { APP_NAME } from "@/lib/brand";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const steps = [
    {
      n: "01",
      title: "File the request",
      body: "A stakeholder writes what they need in plain language. Bug or feature, it starts in the same place.",
    },
    {
      n: "02",
      title: "Baton investigates",
      body: "It drives the app to reproduce a bug, or reads the repository to scope a feature. Then it writes the BRD as Gherkin with acceptance criteria and explicit assumptions.",
    },
    {
      n: "03",
      title: "You hold the gate",
      body: "Accept, alter or reject the requirements before any code is written. The decision, and the reason, stay on the record.",
    },
    {
      n: "04",
      title: "It ships with evidence",
      body: "Baton files the Jira tickets, plans and builds on a branch, runs the acceptance and regression checks in a browser, and opens the pull request.",
    },
  ];

  const values = [
    {
      title: "Requirements that trace to code",
      body: "Every scenario links back to the request that caused it and forward to the ticket, branch, test and pull request that satisfy it.",
    },
    {
      title: "Jira stays the source of truth",
      body: "Baton does not replace your tracker. It files the product, design, backend, frontend and DevOps tickets under the epic you already use.",
    },
    {
      title: "QA before the PR",
      body: "Acceptance, bug-fix and regression checks run against the real app, not a mock. The PR arrives with evidence attached.",
    },
    {
      title: "The context survives",
      body: "Decisions, rejected requirements, questions and releases are kept. The next request does not start from a blank page.",
    },
  ];

  return (
    <div className="landing">
      <header className="landing-header">
        <Link href="/" className="landing-brand" aria-label={`${APP_NAME} home`}>
          <span className="landing-mark" aria-hidden>
            ⟡
          </span>
          {APP_NAME}
        </Link>
        <nav className="landing-nav" aria-label="Primary">
          <a href="#how">How it works</a>
          <a href="#why">Why Baton</a>
          <a href="#integrations">Integrations</a>
          <Link href="/login">Sign in</Link>
          <Link href="/register" className="landing-button small">
            Start free
          </Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="landing-kicker">The AI senior BA</p>
            <h1>Your delivery team&apos;s missing BA.</h1>
            <p className="landing-lede">
              Baton turns a stakeholder request into approved Gherkin requirements,
              Jira tickets and a QA-verified pull request. You keep the judgement.
              It keeps the thread.
            </p>
            <div className="landing-actions">
              <form action={enterDemo}>
                <button className="landing-button" type="submit">
                  Explore the demo workspace
                </button>
              </form>
              <Link href="/register" className="landing-button secondary">
                Create your workspace
              </Link>
            </div>
            <p className="landing-note">
              No setup, no card. The demo is a populated workspace with requests at
              three different pipeline stages.
            </p>
          </div>

          <div className="landing-board" aria-label="A request moving through the pipeline">
            <div className="landing-board-head">
              <span className="landing-dot" aria-hidden />
              <span>ACME-1012</span>
              <span className="landing-board-status">Awaiting approval</span>
            </div>
            <h2>Saved payment methods at checkout</h2>
            <p className="landing-board-lede">
              Returning customers should not re-enter a card they have already
              saved. Adding a new card must not lose the basket.
            </p>
            <div className="landing-track" aria-hidden>
              <span className="done">UX check</span>
              <span className="done">BRD</span>
              <span className="active">Approval</span>
              <span>Build</span>
              <span>QA</span>
              <span>PR</span>
            </div>
            <div className="landing-artifact">
              <p className="landing-artifact-label">Given / When / Then</p>
              <pre>{`Given I have a saved card
When I reach the payment step
Then my saved card is selected
And my basket is unchanged`}</pre>
            </div>
            <div className="landing-board-foot">
              <span>Jira · ACME-1001</span>
              <span>GitHub · acme/storefront</span>
            </div>
          </div>
        </section>

        <section id="how" className="landing-section">
          <div className="landing-section-head">
            <p className="landing-kicker">How it works</p>
            <h2>One request. One honest thread.</h2>
            <p>
              The work between &quot;someone asked for this&quot; and &quot;it is
              verified in production&quot; is where requirements drift and context
              gets lost. Baton makes that thread explicit.
            </p>
          </div>
          <ol className="landing-steps">
            {steps.map((step) => (
              <li key={step.n}>
                <span className="landing-step-n">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="why" className="landing-section sand">
          <div className="landing-section-head">
            <p className="landing-kicker">Why Baton</p>
            <h2>Not another chatbot. A delivery record.</h2>
            <p>
              Most AI tools write something plausible and leave. Baton writes the
              requirement, waits for a human, and then follows it all the way to a
              tested change.
            </p>
          </div>
          <div className="landing-grid">
            {values.map((value) => (
              <article key={value.title} className="landing-card">
                <h3>{value.title}</h3>
                <p>{value.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="integrations" className="landing-section">
          <div className="landing-section-head">
            <p className="landing-kicker">Plug into the tools you already use</p>
            <h2>It does not ask you to move.</h2>
            <p>
              Bring the tracker and the repository. Baton connects to them, and
              falls back to a deterministic draft when an integration is not
              configured, so the pipeline always runs.
            </p>
          </div>
          <div className="landing-integrations">
            <div>
              <strong>Jira</strong>
              <span>Projects, epics, issues, delivery tickets</span>
            </div>
            <div>
              <strong>GitHub</strong>
              <span>Repos, branches, commits, pull requests</span>
            </div>
            <div>
              <strong>Claude</strong>
              <span>BRD, questions, planning and review</span>
            </div>
            <div>
              <strong>Playwright</strong>
              <span>Acceptance, bug-fix and regression checks</span>
            </div>
          </div>
        </section>

        <section className="landing-cta">
          <h2>See the thread for yourself.</h2>
          <p>
            Open the demo workspace and follow one request from intake to pull
            request.
          </p>
          <div className="landing-actions">
            <form action={enterDemo}>
              <button className="landing-button" type="submit">
                Explore the demo
              </button>
            </form>
            <Link href="/register" className="landing-button secondary">
              Create your workspace
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span>
          {APP_NAME} — the AI senior BA.
        </span>
        <nav aria-label="Footer">
          <Link href="/login">Sign in</Link>
          <Link href="/register">Create account</Link>
          <a href="#how">How it works</a>
        </nav>
      </footer>
    </div>
  );
}
