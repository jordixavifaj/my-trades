import Link from 'next/link';

const links = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/trades', label: 'Trades' },
  { href: '/reports', label: 'Reports' },
  { href: '/chart/pnl', label: 'Charts' },
  { href: '/auth', label: 'Auth' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="text-lg font-bold text-cyan-400">My Trades</span>
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-slate-800">
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  );
}
