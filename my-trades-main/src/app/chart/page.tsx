'use client';

import { Suspense } from 'react';
import { AppShell } from '@/components/AppShell';
import { ChartLabWorkspace } from '@/components/ChartLabWorkspace';
import { useSearchParams } from 'next/navigation';

function ChartContent() {
  const searchParams = useSearchParams();
  const symbol = searchParams.get('symbol') || 'AAPL';
  return <ChartLabWorkspace initialSymbol={symbol} />;
}

export default function ChartPage() {
  return (
    <AppShell>
      <Suspense fallback={<p className="text-sm text-slate-400">Cargando…</p>}>
        <ChartContent />
      </Suspense>
    </AppShell>
  );
}
