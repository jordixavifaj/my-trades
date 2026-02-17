import { AppShell } from '@/components/AppShell';

export default function ChartDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <h1 className="text-3xl font-bold">Chart: {params.id}</h1>
      <p className="mt-2 text-slate-300">Vista específica de visualización para símbolo/estrategia seleccionada.</p>
    </AppShell>
  );
}
