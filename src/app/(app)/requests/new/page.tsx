import { cookies } from "next/headers";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { ensureReposBackfilled, listCompanyRepos, resolveActiveRepo } from "@/lib/repos";
import { ACTIVE_REPO_COOKIE } from "@/lib/workspace";
import { NewRequestForm } from "@/components/NewRequestForm";

export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  const user = await requireUser();
  const company = await db.company.findUnique({ where: { id: user.companyId } });
  if (company?.githubConnected) {
    await ensureReposBackfilled({ id: company.id, githubDefaultRepo: company.githubDefaultRepo });
  }
  const repos = await listCompanyRepos(user.companyId);
  const cookieRepo = cookies().get(ACTIVE_REPO_COOKIE)?.value ?? null;
  const activeRepo = resolveActiveRepo(
    cookieRepo,
    repos.map((r) => r.fullName),
    company?.githubDefaultRepo
  );

  return (
    <div style={{ maxWidth: 640 }}>
      <h2>New request</h2>
      <p className="muted small">
        Describe the problem or the capability you want. Baton captures the
        stakeholder conversation, asks clarifying questions until the brief is
        confirmed, then drafts a BRD for you to approve.
      </p>
      {company?.appBaseUrl && (
        <p className="small">
          Looking at the current UI helps you describe the change:{" "}
          <a href={company.appBaseUrl} target="_blank" rel="noreferrer">
            Open {activeRepo ?? "the app"} ↗
          </a>
        </p>
      )}
      <div className="card">
        <NewRequestForm repos={repos.map((r) => r.fullName)} defaultRepo={activeRepo} />
      </div>
      <p className="small muted">
        Filing opens discovery. Record or paste what the stakeholder wants, answer
        Baton&apos;s questions, then confirm the brief. Only then does the UX check
        and BRD run in the background.
        {repos.length === 0 && company?.githubConnected === false && (
          <> Connect GitHub and add a repository in Settings to target a repo.</>
        )}
      </p>
    </div>
  );
}
