"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/brand";

/**
 * The authenticated shell.
 *
 * Desktop keeps the fixed sidebar. Below 860px the same sidebar becomes an
 * off-canvas drawer behind a compact top bar, so the workspace is usable on a
 * phone without a separate mobile navigation to maintain.
 */
export function AppShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes, including link clicks inside
  // the sidebar itself.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="app-shell">
      <header className="mobile-topbar">
        <button
          type="button"
          className="mobile-menu"
          aria-label="Open navigation"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span aria-hidden>☰</span>
        </button>
        <span className="mobile-brand">
          <span aria-hidden>⟡</span> {APP_NAME}
        </span>
      </header>

      <div className={`sidebar-drawer${open ? " open" : ""}`}>{sidebar}</div>
      {open && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}

      <main className="main">{children}</main>
    </div>
  );
}
