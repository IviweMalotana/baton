import Link from "next/link";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { statusLabel } from "@/lib/pipeline-view";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireUser();

  const [total, awaiting, done, recent, company, memberCount] = await Promise.all([
    db.request.count({ where: { companyId: user.companyId } }),
    db.request.count({
      where: { companyId: user.companyId, status: "AWAITING_APPROVAL" },
    }),
    db.request.count({ where: { companyId: user.companyId, status: "DONE" } }),
    db.request.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.company.findUnique({ where: { id: user.companyId } }),
    db.membership.count({ where: { companyId: user.companyId } }),
  ]);

  const firstName = user.name?.split(" ")[0] || "there";

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>
            {company?.name ?? "Your workspace"}
          </h1>
          <p className="lede">
            Good to see you, {firstName}. Start with the next change, or pick up
            one that is waiting.
          </p>
        </div>
        <Link href="/requests/new" className="btn">
          New request
        </Link>
      </header>

      <div className="grid cols-3" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="stat-label">Awaiting you</div>
          <div className="stat-value">{awaiting}</div>
          <div className="stat-sub">Briefs to confirm or approve</div>
        </div>
        <div className="stat">
          <div className="stat-label">Shipped</div>
          <div className="stat-value">{done}</div>
          <div className="stat-sub">Pull requests opened</div>
        </div>
        <div className="stat">
          <div className="stat-label">The team</div>
          <div className="stat-value">{memberCount}</div>
          <div className="stat-sub">People in this workspace</div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Recent requests</h2>
            <p className="muted small">{total} in total</p>
          </div>
          <Link href="/requests" className="link-button">
            View all
          </Link>
        </div>
        <div className="panel-body">
          {recent.length === 0 ? (
            <p className="muted">
              Nothing yet. <Link href="/requests/new">Start the first interview →</Link>
            </p>
          ) : (
            <table>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/requests/${r.id}`}>{r.title}</Link>
                    </td>
                    <td style={{ width: 170 }}>
                      <span className="badge status">{statusLabel(r.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {!company?.githubConnected && (
        <div className="notice" style={{ marginTop: 14 }}>
          Jira and GitHub are not connected yet.<br />
          <Link href="/settings" className="link-button">
            Connect them in Settings →
          </Link>
        </div>
      )}
    </div>
  );
}
