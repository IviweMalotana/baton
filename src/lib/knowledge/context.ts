import { db } from "@/lib/db";

/**
 * The company context Baton reads before it asks anyone a question.
 *
 * Kept deliberately short: the profile, the voice, and the most recent
 * knowledge items. A snapshot of the company, not a document dump.
 */
export async function getCompanyContext(companyId: string): Promise<string> {
  const [company, items] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: { name: true, about: true, voice: true },
    }),
    db.knowledgeItem.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { kind: true, title: true, content: true },
    }),
  ]);
  if (!company) return "";

  const parts = [
    `Company: ${company.name}`,
    company.about.trim() ? `What they do:\n${company.about.trim()}` : "",
    company.voice.trim() ? `How they speak:\n${company.voice.trim()}` : "",
    ...items.map((i) => `[${i.kind}] ${i.title}\n${i.content.slice(0, 2000)}`),
  ].filter(Boolean);

  return parts.join("\n\n").slice(0, 9000);
}
