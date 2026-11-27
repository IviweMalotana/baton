"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";

export type KnowledgeState = { error?: string; saved?: boolean } | undefined;

/** Company profile: what they do and how they speak. */
export async function saveCompanyProfile(
  _prev: KnowledgeState,
  formData: FormData
): Promise<KnowledgeState> {
  const user = await requireUser();
  const about = String(formData.get("about") ?? "").trim().slice(0, 6000);
  const voice = String(formData.get("voice") ?? "").trim().slice(0, 3000);

  await db.company.update({
    where: { id: user.companyId },
    data: { about, voice },
  });

  revalidatePath("/knowledge");
  return { saved: true };
}

/** A pasted note, decision or glossary entry. */
export async function addKnowledgeNote(
  _prev: KnowledgeState,
  formData: FormData
): Promise<KnowledgeState> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const content = String(formData.get("content") ?? "").trim();

  if (!title) return { error: "Give the note a short title." };
  if (content.length < 20) return { error: "Add a little more detail." };

  await db.knowledgeItem.create({
    data: {
      companyId: user.companyId,
      createdById: user.id,
      kind: "note",
      title,
      content: content.slice(0, 20000),
    },
  });

  revalidatePath("/knowledge");
  return { saved: true };
}

export async function deleteKnowledge(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.knowledgeItem.deleteMany({ where: { id, companyId: user.companyId } });
  revalidatePath("/knowledge");
}
