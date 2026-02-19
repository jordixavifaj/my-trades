import Link from 'next/link';
import { ReactNode } from 'react';

const links = [
  { href: '/', label: 'Inicio' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/trades', label: 'Trades' },
  { href: '/reports', label: 'Reports' },
  { href: '/chartlab', label: 'Chart Lab' },
  { href: '/auth', label: 'Auth' },
];

export function AppShell({ children }: { children: ReactNode }) {
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
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg border border-transparent px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100"
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
