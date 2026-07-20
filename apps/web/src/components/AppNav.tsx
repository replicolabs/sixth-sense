"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";

const LINKS = [
  { href: "/home", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/pools", label: "Pools" },
  { href: "/classics", label: "Classics" },
];

/**
 * Shared header for every signed-in-app screen (home, leaderboard, pools,
 * classics). The landing page (/) does not use this, it has its own
 * single hero CTA instead, per the rule that sign-in UI belongs in one
 * place, not repeated on every screen.
 */
export function AppNav() {
  const pathname = usePathname();
  return (
    <header className="flex items-center justify-between">
      <Logo iconSize={24} />
      <nav className="flex items-center gap-1 rounded-[var(--r-pill)] p-1 sm:gap-1.5">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-[var(--r-pill)] px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-[var(--pine-700)] text-[var(--cream)]" : "text-[var(--pine-700)] hover:bg-[var(--cream-sunken)]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
