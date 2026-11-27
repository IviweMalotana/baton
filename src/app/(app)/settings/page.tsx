import Link from "next/link";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { logout } from "@/app/actions/auth";
import { features } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const [company, jira, members, knowledge] = await Promise.all([
    db.company.findUnique({ where: { id: user.companyId } }),
    db.jiraConnection.findUnique({ where: { companyId: user.companyId } }),
    db.membership.count({ where: { companyId: user.companyId } }),
    db.knowledgeItem.count({ where: { companyId: user.companyId } }),
  ]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>{company?.name ?? "Workspace"}</h1>
          <p className="lede">
            Your account, the tools Baton uses, and the people who can see the work.
          </p>
        </div>
      </header>

      <div className="grid cols-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Connections</h2>
            <span className="badge">{jira ? "Jira on" : "Jira off"} · {company?.githubConnected ? "GitHub on" : "GitHub off"}</span>
          </div>
          <div className="panel-body stack">
            <p className="muted small">
              Jira is where Baton files delivery tickets. GitHub is the repo it reads
              and, when you approve, commits to.
            </p>
            <div>
              <Link href="/integrations" className="btn secondary small">
                Manage integrations
              </Link>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Company voice</h2>
            <span className="badge">{knowledge} item{knowledge === 1 ? "" : "s"}</span>
          </div>
          <div className="panel-body stack">
            <p className="muted small">
              What Baton reads before it interviews anyone: the profile, the voice,
              documents and call recordings.
            </p>
            <div>
              <Link href="/knowledge" className="btn secondary small">
                Open knowledge
              </Link>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Team</h2>
            <span className="badge">{members} member{members === 1 ? "" : "s"}</span>
          </div>
          <div className="panel-body stack">
            <p className="muted small">
              Invite BAs, product and QA. Roles decide who can run the pipeline and
              who can only read.
            </p>
            <div>
              <Link href="/members" className="btn secondary small">
                Manage team
              </Link>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Security</h2>
            <span className="badge">{features.ai ? "AI on" : "Fallback"}</span>
          </div>
          <div className="panel-body stack">
            <p className="muted small">
              Passwords are hashed with bcrypt. Sessions are signed, http-only
              cookies. Jira and GitHub tokens are encrypted at rest. Sign-in is
              rate-limited and locks after repeated failures.
            </p>
            <div className="row" style={{ gap: 12 }}>
              <Link href="/settings/profile" className="btn secondary small">
                Profile
              </Link>
              <Link href="/settings/security" className="btn secondary small">
                Sessions
              </Link>
            </div>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 14 }}>
        <div className="panel-head">
          <div>
            <h2>{user.name ?? user.email}</h2>
            <p className="muted small">{user.email} · {user.role}</p>
          </div>
          <form action={logout}>
            <button className="btn secondary small" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
