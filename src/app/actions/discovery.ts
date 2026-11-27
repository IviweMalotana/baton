"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { logEvent } from "@/lib/agents/orchestrator";
import { nextDiscoveryStep } from "@/lib/agents/discovery";
import { enqueue } from "@/lib/queue";

export type DiscoveryActionState = { error?: string; saved?: boolean } | undefined;

const MAX_TRANSCRIPT = 30000;

async function loadDiscovery(requestId: string, companyId: string) {
  return db.request.findFirst({
    where: { id: requestId, companyId },
    include: { discoveryTurns: { orderBy: { createdAt: "asc" } } },
  });
}

/**
 * Persist a voice segment transcribed by Deepgram. Callable directly from the
 * client after the recorder stops, so the transcript survives a page refresh.
 */
export async function saveVoiceTranscript(requestId: string, text: string): Promise<void> {
  const user = await requireUser();
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return;

  const request = await db.request.findFirst({
    where: { id: requestId, companyId: user.companyId },
    select: { id: true, status: true, discoveryTranscript: true },
  });
  if (!request) return;

  const nextTranscript = `${request.discoveryTranscript}\n${clean}`.trim().slice(-MAX_TRANSCRIPT);
  await db.$transaction([
    db.discoveryTurn.create({
      data: {
        requestId,
        role: "stakeholder",
        content: clean.slice(0, 8000),
        source: "voice",
      },
    }),
    db.request.update({
      where: { id: requestId },
      data: {
        discoveryTranscript: nextTranscript,
        discoveryState: request.status === "DISCOVERY" ? "questioning" : undefined,
      },
    }),
  ]);

  await logEvent(requestId, "discovery", "Stakeholder voice captured via Deepgram.");

  // Respond immediately: the next question (or readiness) should follow the
  // stakeholder's answer without a second click.
  const refreshed = await loadDiscovery(requestId, user.companyId);
  await advance(requestId, user.companyId, refreshed);

  revalidatePath(`/requests/${requestId}`);
}

/** Paste or type a transcript / meeting notes instead of recording. */
export async function addTranscript(
  _prev: DiscoveryActionState,
  formData: FormData
): Promise<DiscoveryActionState> {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (text.length < 10) return { error: "Add a little more of what the stakeholder said." };

  const request = await loadDiscovery(requestId, user.companyId);
  if (!request) return { error: "Request not found." };
  if (request.status !== "DISCOVERY" && request.status !== "QUESTIONS") {
    return { error: "Discovery is closed for this request." };
  }

  const nextTranscript = `${request.discoveryTranscript}\n${text}`.trim().slice(-MAX_TRANSCRIPT);
  await db.$transaction([
    db.discoveryTurn.create({
      data: { requestId, role: "stakeholder", content: text.slice(0, 8000), source: "text" },
    }),
    db.request.update({
      where: { id: requestId },
      data: { discoveryTranscript: nextTranscript, discoveryState: "questioning" },
    }),
  ]);

  revalidatePath(`/requests/${requestId}`);

  const refreshed = await loadDiscovery(requestId, user.companyId);
  await advance(requestId, user.companyId, refreshed);

  return { saved: true };
}

/** Ask the next single question, or mark the brief ready. */
export async function askNextQuestion(formData: FormData): Promise<void> {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  const request = await loadDiscovery(requestId, user.companyId);
  if (!request) redirect("/requests");
  if (request.status !== "DISCOVERY" && request.status !== "QUESTIONS") {
    redirect(`/requests/${requestId}`);
  }

  await advance(requestId, user.companyId, request);
  revalidatePath(`/requests/${requestId}`);
  redirect(`/requests/${requestId}`);
}

/** Stakeholder answer. Persists it, then asks the next question immediately. */
export async function answerDiscovery(
  _prev: DiscoveryActionState,
  formData: FormData
): Promise<DiscoveryActionState> {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  const answer = String(formData.get("answer") ?? "").trim();
  if (answer.length < 2) return { error: "Type the stakeholder's answer first." };

  const request = await loadDiscovery(requestId, user.companyId);
  if (!request) return { error: "Request not found." };
  if (request.status !== "DISCOVERY" && request.status !== "QUESTIONS") {
    return { error: "Discovery is closed for this request." };
  }

  await db.discoveryTurn.create({
    data: { requestId, role: "stakeholder", content: answer.slice(0, 8000), source: "text" },
  });
  await logEvent(requestId, "discovery", "Stakeholder answered a clarifying question.");

  await advance(requestId, user.companyId, request);
  revalidatePath(`/requests/${requestId}`);
  return { saved: true };
}

/** Freeze the brief and release it to the UX check + BRD agents. */
export async function confirmDiscovery(formData: FormData): Promise<void> {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  const request = await loadDiscovery(requestId, user.companyId);
  if (!request) redirect("/requests");

  if (request.discoveryState !== "ready" || request.discoveryBrief.trim().length < 10) {
    redirect(`/requests/${requestId}`);
  }

  await db.request.update({
    where: { id: requestId },
    data: { discoveryState: "confirmed", status: "UX_CHECK" },
  });
  await logEvent(
    requestId,
    "discovery",
    "Brief confirmed with the stakeholder. Handing to the UX check and BRD agent."
  );
  await enqueue("to_approval", requestId);

  revalidatePath(`/requests/${requestId}`);
  redirect(`/requests/${requestId}`);
}

/**
 * Run one interview turn and persist both the decision and the question.
 * Kept out of the exported actions so every caller gets the same behaviour.
 */
async function advance(
  requestId: string,
  companyId: string,
  request: Awaited<ReturnType<typeof loadDiscovery>>
): Promise<void> {
  if (!request) return;

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { modelRouting: true },
  });

  const decision = await nextDiscoveryStep({
    title: request.title,
    description: request.description,
    transcript: request.discoveryTranscript,
    turns: request.discoveryTurns.map((t) => ({ role: t.role, content: t.content })),
    routing: company?.modelRouting ?? null,
  });

  if (decision.status === "question" && decision.question) {
    await db.$transaction([
      db.discoveryTurn.create({
        data: { requestId, role: "agent", content: decision.question, source: "text" },
      }),
      db.request.update({
        where: { id: requestId },
        data: { discoveryState: "questioning", discoveryBrief: decision.summary },
      }),
    ]);
    await logEvent(requestId, "discovery", `Clarifying question asked (${decision.model}).`, {
      reason: decision.reason,
      openItems: decision.openItems,
      model: decision.model,
    });
    return;
  }

  await db.request.update({
    where: { id: requestId },
    data: { discoveryState: "ready", discoveryBrief: decision.summary },
  });
  await logEvent(
    requestId,
    "discovery",
    `Every open point is answered (${decision.model}). Brief ready for the stakeholder to confirm.`
  );
}
