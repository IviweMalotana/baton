import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { ensureReposBackfilled, listCompanyRepos } from "@/lib/repos";
import { NewRequestForm } from "@/components/NewRequestForm";

export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  const user = await requireUser();
  const company = await db.company.findUnique({ where: { id: user.companyId } });
  if (company?.githubConnected) {
    await ensureReposBackfilled({ id: company.id, githubDefaultRepo: company.githubDefaultRepo });
  }
  const repos = await listCompanyRepos(user.companyId);
  const names = repos.map((r) => r.fullName);
  const activeRepo =
    company?.githubDefaultRepo && names.includes(company.githubDefaultRepo)
      ? company.githubDefaultRepo
      : names[0] ?? null;

  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">Request</p>
          <h1>What are we changing?</h1>
          <p className="lede">
            Describe the problem. Baton captures the stakeholder conversation, asks
            until the brief is confirmed, then drafts the requirements.
          </p>
        </div>
      </header>

      {company?.appBaseUrl && (
        <p className="small muted" style={{ marginBottom: 14 }}>
          The current UI may help you describe it:{" "}
          <a href={company.appBaseUrl} target="_blank" rel="noreferrer">
            Open {activeRepo ?? "the app"} ↗
          </a>
        </p>
      )}

      <div className="panel">
        <div className="panel-body">
          <NewRequestForm repos={names} defaultRepo={activeRepo} />
        </div>
      </div>

      <p className="small muted" style={{ marginTop: 14 }}>
        Filing opens discovery. Record or paste what the stakeholder wants, answer
        Baton&apos;s questions, then confirm the brief.
        {repos.length === 0 && company?.githubConnected === false && (
          <> Connect GitHub in Settings to target a repository.</>
        )}
      </p>
    </div>
  );
}
