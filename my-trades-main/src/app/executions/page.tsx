'use client';

import { Suspense } from 'react';
import { AppShell } from '@/components/AppShell';
import { ExecutionsWorkspace } from '@/components/ExecutionsWorkspace';
import { useSearchParams } from 'next/navigation';

function ExecutionsContent() {
  const searchParams = useSearchParams();
  const symbol = searchParams.get('symbol') || '';
  const date = searchParams.get('date') || '';
  return <ExecutionsWorkspace symbol={symbol} date={date} />;
}

export default function ExecutionsPage() {
  return (
    <AppShell>
      <Suspense fallback={<p className="text-sm text-slate-400">Cargando…</p>}>
        <ExecutionsContent />
      </Suspense>
    </AppShell>
  );
}
