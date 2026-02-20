'use client';

import Link from 'next/link';
import { ReactNode, useEffect, useState } from 'react';

type UserRole = 'ADMIN' | 'TRADER' | 'MENTOR' | 'STUDENT';

type NavLink = { href: string; label: string; roles?: UserRole[] };

const allLinks: NavLink[] = [
  { href: '/', label: 'Inicio' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/trades', label: 'Trades' },
  { href: '/reports', label: 'Reports' },
  { href: '/community', label: 'Comunidad' },
  { href: '/mentor', label: 'Mis Alumnos', roles: ['MENTOR', 'ADMIN'] },
  { href: '/admin', label: 'Admin', roles: ['ADMIN'] },
  { href: '/chart/SPY', label: 'Chart Lab' },
  { href: '/auth', label: 'Auth' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { const r = data?.role ?? data?.user?.role; if (r) setRole(r as UserRole); })
      .catch(() => {});
  }, []);

  const visibleLinks = allLinks.filter((l) => {
    if (!l.roles) return true;
    if (!role) return false;
    return l.roles.includes(role);
  });

  return (
    <div className="min-h-screen text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-sm font-bold text-cyan-300">MT</span>
            <div>
              <p className="text-base font-semibold tracking-tight">My Trades Pro</p>
              <p className="text-xs text-slate-400">Trading journal + analytics</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {visibleLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg border border-transparent px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100"
              >
                {label}
              </Link>
            ))}
            {role && (
              <span className="ml-2 rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-medium text-slate-400">
                {role}
              </span>
            )}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
