import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { enterDemo } from "@/app/actions/auth";
import { APP_NAME } from "@/lib/brand";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="site">
      <section className="site-panel">
        <header className="site-nav">
          <Link href="/" className="brand" aria-label={`${APP_NAME} home`}>
            <span className="brand-dot" aria-hidden />
            {APP_NAME}
          </Link>
          <nav className="site-links" aria-label="Primary">
            <a href="#how">How it works</a>
            <a href="#paths">Who it is for</a>
            <Link href="/login">Sign in</Link>
            <Link href="/register" className="btn small">
              Start
            </Link>
          </nav>
        </header>

        <div className="hero">
          <div className="hero-mark" aria-hidden>
            B
          </div>
          <h1>A senior BA, on tap.</h1>
          <p className="lede">
            Baton listens to the stakeholder, asks until the brief is clear, and
            turns it into requirements your team can build. One BA, or a whole
            company. Nothing is assumed.
          </p>
          <div className="hero-actions">
            <Link href="/register" className="btn">
              Start free
            </Link>
            <form action={enterDemo}>
              <button className="btn secondary" type="submit">
                See the demo
              </button>
            </form>
          </div>
          <p className="hero-note">No card. Connect Jira and GitHub when you are ready.</p>
        </div>

        <div className="trust" aria-label="Works with">
          <span>Jira</span>
          <span>GitHub</span>
          <span>Deepgram</span>
          <span>DeepSeek</span>
        </div>
      </section>

      <section className="site-panel site-section" id="paths">
        <h2>Two ways to use it.</h2>
        <p className="lede">The work is the same. Who holds the account is different.</p>
        <div className="paths">
          <article className="path">
            <p className="eyebrow">I am the BA</p>
            <h3>Bring your own tools</h3>
            <p>
              Connect your Jira and GitHub, run the stakeholder interview, and
              ship a BRD your team can build from.
            </p>
            <ul>
              <li>Personal workspace</li>
              <li>Your repos and your tracker</li>
              <li>Every transcript and decision kept</li>
            </ul>
            <Link href="/register?type=ba" className="btn small">
              Start as a BA
            </Link>
          </article>

          <article className="path">
            <p className="eyebrow">I am hiring</p>
            <h3>Give a team its BA</h3>
            <p>
              Create the company, invite the BAs, and see every request, brief and
              approval in one place.
            </p>
            <ul>
              <li>Company workspace</li>
              <li>Invite and remove BAs</li>
              <li>One shared company voice</li>
            </ul>
            <Link href="/register?type=company" className="btn small">
              Create a company
            </Link>
          </article>
        </div>
      </section>

      <section className="site-panel site-section" id="how">
        <h2>From conversation to confirmed brief.</h2>
        <div className="features">
          <article className="feature">
            <span className="feature-num">01</span>
            <h3>It listens</h3>
            <p>
              Record the stakeholder with Deepgram, or paste the notes. Speaker
              labels and a verbatim transcript.
            </p>
          </article>
          <article className="feature">
            <span className="feature-num">02</span>
            <h3>It asks</h3>
            <p>
              One question at a time until users, outcome, scope, edge cases and
              success are settled. It will not invent an answer.
            </p>
          </article>
          <article className="feature">
            <span className="feature-num">03</span>
            <h3>It writes</h3>
            <p>
              A plain-language BRD with Given/When/Then, acceptance criteria and
              the delivery tickets, ready for your approval.
            </p>
          </article>
          <article className="feature">
            <span className="feature-num">04</span>
            <h3>It remembers</h3>
            <p>
              Company profile, voice notes and documents live in one place and are
              read before every interview.
            </p>
          </article>
        </div>
      </section>

      <section className="site-cta">
        <h2>Start with the next change.</h2>
        <p>
          Open a workspace, upload how your company speaks, and let Baton run the
          first interview.
        </p>
        <Link href="/register" className="btn">
          Create a workspace
        </Link>
      </section>

      <footer className="site-footer">
        <span>
          © {new Date().getFullYear()} {APP_NAME}. A senior BA, on tap.
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
