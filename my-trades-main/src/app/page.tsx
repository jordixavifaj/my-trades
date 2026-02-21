'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.role || data?.role) {
          setIsLoggedIn(true);
          router.push('/dashboard');
        }
      })
      .catch(() => {});
  }, [router]);

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData.entries())),
      });

      const contentType = res.headers.get('content-type') || '';
      const result = contentType.includes('application/json')
        ? await res.json().catch(() => null)
        : null;

      if (!res.ok) {
        setMessage(result?.error ?? 'No se pudo crear la cuenta');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setMessage('Error de red. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Redirigiendo al dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-100">
      {/* Minimal header */}
      <header className="border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-sm font-bold text-cyan-300">MT</span>
            <div>
              <p className="text-base font-semibold tracking-tight">My Trades Pro</p>
              <p className="text-xs text-slate-400">Trading journal + analytics</p>
            </div>
          </div>
          <Link
            href="/auth"
            className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        {/* Hero + Registration */}
        <section className="grid items-start gap-10 lg:grid-cols-[1.3fr_1fr]">
          {/* Left — Hero text */}
          <div className="pt-4">
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
              Plataforma de journaling profesional
            </p>
            <h1 className="mb-5 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              Analiza tu trading con una experiencia de nivel institucional.
            </h1>
            <p className="mb-6 max-w-xl text-lg text-slate-400">
              Importa tus operaciones, visualiza métricas clave, genera reportes detallados y lleva tu diario de trading al siguiente nivel.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                </div>
                <h3 className="text-sm font-semibold">Dashboard</h3>
                <p className="mt-1 text-xs text-slate-400">P&L, Win Rate, Profit Factor y calendario de rendimiento en tiempo real.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
                </div>
                <h3 className="text-sm font-semibold">Reports</h3>
                <p className="mt-1 text-xs text-slate-400">Análisis detallado por símbolo, por día, por setup y distribución de resultados.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                </div>
                <h3 className="text-sm font-semibold">Calendario</h3>
                <p className="mt-1 text-xs text-slate-400">Visualiza tu P&L diario en un calendario interactivo con colores por rendimiento.</p>
              </div>
            </div>
          </div>

          {/* Right — Registration form */}
          <div className="panel p-6">
            <h2 className="mb-1 text-xl font-semibold">Crea tu cuenta gratis</h2>
            <p className="mb-5 text-sm text-slate-400">Empieza a analizar tu trading en menos de 1 minuto.</p>

            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-400">Nombre</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Tu nombre"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none ring-cyan-500/70 placeholder:text-slate-500 focus:ring-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-400">Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="tu@email.com"
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none ring-cyan-500/70 placeholder:text-slate-500 focus:ring-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-400">Contraseña</label>
                <input
                  type="password"
                  name="password"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none ring-cyan-500/70 placeholder:text-slate-500 focus:ring-2"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
              >
                {submitting ? 'Creando cuenta...' : 'Crear cuenta gratis'}
              </button>
            </form>

            {message && (
              <p className="mt-3 rounded-lg bg-rose-950/50 border border-rose-800 p-2.5 text-sm text-rose-300">{message}</p>
            )}

            <p className="mt-4 text-center text-sm text-slate-500">
              ¿Ya tienes cuenta?{' '}
              <Link href="/auth" className="text-cyan-400 hover:text-cyan-300">Inicia sesión</Link>
            </p>
          </div>
        </section>

        {/* Visual previews */}
        <section className="mt-16">
          <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">
            Todo lo que necesitas para mejorar tu trading
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Dashboard preview */}
            <div className="panel overflow-hidden">
              <div className="border-b border-slate-800 px-5 py-3">
                <h3 className="text-sm font-semibold text-cyan-300">Dashboard</h3>
                <p className="text-xs text-slate-500">Vista general de tu rendimiento</p>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-slate-800/60 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Total P&L</p>
                    <p className="text-lg font-semibold text-emerald-400">+$2,450</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Win Rate</p>
                    <p className="text-lg font-semibold text-cyan-300">68%</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Profit Factor</p>
                    <p className="text-lg font-semibold text-violet-300">2.1</p>
                  </div>
                </div>
                {/* Mini chart mockup */}
                <div className="mt-4 flex items-end gap-1 h-20">
                  {[35, 50, 30, 65, 45, 70, 55, 80, 40, 60, 75, 50, 85, 65, 90, 70, 55, 80, 95, 75].map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-sm ${h > 50 ? 'bg-emerald-500/40' : 'bg-rose-500/30'}`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-600 text-center">Equity curve - últimos 20 trades</p>
              </div>
            </div>

            {/* Reports preview */}
            <div className="panel overflow-hidden">
              <div className="border-b border-slate-800 px-5 py-3">
                <h3 className="text-sm font-semibold text-emerald-300">Reports</h3>
                <p className="text-xs text-slate-500">Análisis detallado de operaciones</p>
              </div>
              <div className="p-5">
                <div className="space-y-2">
                  {[
                    { symbol: 'AAPL', trades: 12, pnl: '+$680', color: 'text-emerald-400' },
                    { symbol: 'SPY',  trades: 8,  pnl: '+$420', color: 'text-emerald-400' },
                    { symbol: 'TSLA', trades: 15, pnl: '-$180', color: 'text-rose-400' },
                    { symbol: 'NVDA', trades: 6,  pnl: '+$950', color: 'text-emerald-400' },
                    { symbol: 'META', trades: 9,  pnl: '+$310', color: 'text-emerald-400' },
                  ].map((row) => (
                    <div key={row.symbol} className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-slate-700 text-[10px] font-bold text-slate-300">{row.symbol.slice(0, 2)}</span>
                        <div>
                          <p className="text-sm font-medium">{row.symbol}</p>
                          <p className="text-[10px] text-slate-500">{row.trades} trades</p>
                        </div>
                      </div>
                      <p className={`text-sm font-semibold ${row.color}`}>{row.pnl}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 border-t border-slate-800/60 py-6 text-center text-xs text-slate-600">
          My Trades Pro — Tu journal de trading profesional
        </footer>
      </main>
    </div>
  );
}
