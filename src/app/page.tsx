import CSVUploader from '@/components/CSVUploader';
import { AppShell } from '@/components/AppShell';

export default function Home() {
  return (
    <AppShell>
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h1 className="mb-3 text-4xl font-bold">Trading Journal estilo Tradervue</h1>
          <p className="text-slate-300">
            Gestiona operaciones, estrategias, métricas y reportes en un dashboard responsivo con importación DAS Trader.
          </p>
        </div>
        <CSVUploader />
      </section>
    </AppShell>
  );
}
