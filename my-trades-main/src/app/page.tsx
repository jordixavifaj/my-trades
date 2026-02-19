import CSVUploader from '@/components/CSVUploader';
import { AppShell } from '@/components/AppShell';
import Link from 'next/link';

export default function Home() {
  return (
    <AppShell>
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel p-8">
          <p className="mb-3 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
            Plataforma de journaling profesional
          </p>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight md:text-5xl">Analiza tu trading con una experiencia de nivel institucional.</h1>
          <p className="max-w-2xl text-slate-300">
            Dashboard moderno, métricas accionables, calendario visual y análisis estilo Tradervue para que conviertas datos en decisiones.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard" className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400">
              Ir al dashboard
            </Link>
            <Link href="/chart/SPY" className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800">
              Abrir chart lab
            </Link>
          </div>
        </div>

        <CSVUploader />
      </section>
    </AppShell>
  );
}
