import Link from "next/link";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { features } from "@/lib/env";
import { deleteKnowledge } from "@/app/actions/knowledge";
import {
  AddNoteForm,
  CompanyProfileForm,
  UploadKnowledge,
} from "@/components/KnowledgeForms";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  note: "Note",
  document: "Document",
  voice: "Voice",
};

export default async function KnowledgePage() {
  const user = await requireUser();
  const [company, items] = await Promise.all([
    db.company.findUnique({
      where: { id: user.companyId },
      select: { name: true, about: true, voice: true },
    }),
    db.knowledgeItem.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Company voice</p>
          <h1>What Baton should know</h1>
          <p className="lede">
            The context Baton reads before it talks to a stakeholder. Keep it short
            and specific: what {company?.name ?? "the company"} does, how it speaks,
            and the recordings or notes that explain the work.
          </p>
        </div>
        <Link href="/requests/new" className="btn">
          New request
        </Link>
      </header>

      <div className="two-col">
        <CompanyProfileForm about={company?.about ?? ""} voice={company?.voice ?? ""} />
        <UploadKnowledge deepgramEnabled={features.deepgram} />
      </div>

      <AddNoteForm />

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Knowledge</h2>
            <p className="muted small">
              {items.length} item{items.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="panel-body">
          {items.length === 0 ? (
            <p className="muted">
              Nothing yet. Upload a call recording, paste a decision, or write down
              how the business works.
            </p>
          ) : (
            <ul className="knowledge-list">
              {items.map((item) => (
                <li key={item.id}>
                  <div className="knowledge-main">
                    <div className="knowledge-title">
                      <span className={`badge ${item.kind}`}>{KIND_LABEL[item.kind] ?? item.kind}</span>
                      {item.title}
                    </div>
                    <p className="muted small knowledge-preview">
                      {item.content.replace(/\s+/g, " ").slice(0, 220)}
                      {item.content.length > 220 ? "…" : ""}
                    </p>
                    <p className="muted small">
                      {item.source ? `${item.source} · ` : ""}
                      {item.createdAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <form action={deleteKnowledge}>
                    <input type="hidden" name="id" value={item.id} />
                    <button className="link-button" type="submit">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
