import type { ReactNode } from "react";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";

function initials(name: string | null, email: string): string {
  const base = (name || email).trim();
  const parts = base.split(/[\s/]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const company = await db.company.findUnique({
    where: { id: user.companyId },
    select: { name: true },
  });

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        initials: initials(user.name, user.email),
      }}
      companyName={company?.name ?? "Workspace"}
    >
      {children}
    </AppShell>
  );
}
