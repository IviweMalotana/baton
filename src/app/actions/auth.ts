"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { DEMO, seedDemoWorkspace } from "@/lib/demo";
import { consume, reset } from "@/lib/rate-limit";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace"
  );
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let n = 1;
  while (await db.company.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

function clientIp(): string {
  const forwarded = headers().get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || headers().get("x-real-ip") || "local";
}

const registerSchema = z
  .object({
    accountType: z.enum(["ba", "company"]).default("company"),
    companyName: z.string().optional(),
    name: z.string().min(1, "Your name is required"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(10, "Password must be at least 10 characters"),
  })
  .superRefine((value, ctx) => {
    if (value.accountType === "company" && (value.companyName ?? "").trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["companyName"],
        message: "Company name is too short",
      });
    }
  });

export type ActionState = { error?: string } | undefined;

/**
 * Register a BA (personal workspace) or a company (shared workspace).
 * The account type only decides the initial workspace name: every account gets
 * an owner, and can invite more people later.
 */
export async function registerCompany(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    accountType: formData.get("accountType") ?? "company",
    companyName: formData.get("companyName") ?? undefined,
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { accountType, companyName, name, email, password } = parsed.data;

  const gate = consume(`register:${clientIp()}`, 10, 60 * 60 * 1000);
  if (!gate.allowed) {
    return { error: "Too many accounts created from here. Try again later." };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists. Sign in instead." };
  }

  const workspaceName =
    accountType === "company"
      ? (companyName ?? "").trim()
      : `${name.trim()}'s workspace`;

  const slug = await uniqueSlug(slugify(workspaceName));
  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash,
      memberships: {
        create: {
          role: "OWNER",
          company: { create: { name: workspaceName, slug } },
        },
      },
    },
  });

  await createSession({ userId: user.id, email: user.email });
  redirect("/dashboard");
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function login(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, password } = parsed.data;
  const ip = clientIp();

  const gate = consume(`login:${ip}:${email}`, 8, LOCK_MINUTES * 60 * 1000);
  if (!gate.allowed) {
    return {
      error: `Too many attempts. Try again in ${Math.ceil(gate.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return { error: "Incorrect email or password" };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.max(
      1,
      Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
    );
    return { error: `Too many attempts. Try again in ${minutes} minutes.` };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failed,
        lockedUntil:
          failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
      },
    });
    return {
      error:
        failed >= MAX_FAILED
          ? `Too many attempts. Try again in ${LOCK_MINUTES} minutes.`
          : "Incorrect email or password",
    };
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null },
  });
  reset(`login:${ip}:${email}`);

  await createSession({ userId: user.id, email: user.email });
  redirect("/dashboard");
}

/**
 * One-click demo access for the public site. If the demo workspace was never
 * seeded (for example a fresh Vercel deployment with no shell), create it first
 * so the button always works.
 */
export async function enterDemo(): Promise<void> {
  let user = await db.user.findUnique({ where: { email: DEMO.email } });
  if (!user) {
    await seedDemoWorkspace();
    user = await db.user.findUnique({ where: { email: DEMO.email } });
  }
  if (!user) redirect("/register?demo=unavailable");
  await createSession({ userId: user.id, email: user.email });
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  destroySession();
  redirect("/login");
}
