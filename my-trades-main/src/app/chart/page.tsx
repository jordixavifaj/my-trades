'use client';

import { AppShell } from '@/components/AppShell';
import { ChartLabWorkspace } from '@/components/ChartLabWorkspace';
import { useSearchParams } from 'next/navigation';

export default function ChartPage() {
  const searchParams = useSearchParams();
  const symbol = searchParams.get('symbol') || 'AAPL';

  return (
    <AppShell>
      <ChartLabWorkspace initialSymbol={symbol} />
    </AppShell>
  );
}
