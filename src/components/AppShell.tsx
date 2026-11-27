"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import { APP_NAME } from "@/lib/brand";

const NAV = [
  { href: "/requests", label: "Requests" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/members", label: "Team" },
  { href: "/settings", label: "Settings" },
] as const;

export function AppShell({
  user,
  companyName,
  children,
}: {
  user: { name: string | null; email: string; initials: string };
  companyName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="appv2">
      <header className="appv2-bar">
        <div className="appv2-inner">
          <Link href="/dashboard" className="brand" aria-label={`${APP_NAME} home`}>
            <span className="brand-dot" aria-hidden />
            {APP_NAME}
          </Link>

          <nav className="appv2-nav" aria-label="Workspace">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={isActive(item.href) ? "active" : undefined}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="appv2-user">
            <span className="avatar" aria-hidden>
              {user.initials}
            </span>
            <span className="user-email muted small">{companyName}</span>
            <form action={logout}>
              <button className="link-button" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
