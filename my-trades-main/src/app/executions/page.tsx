'use client';

import { AppShell } from '@/components/AppShell';
import { ExecutionsWorkspace } from '@/components/ExecutionsWorkspace';
import { useSearchParams } from 'next/navigation';

export default function ExecutionsPage() {
  const searchParams = useSearchParams();
  const symbol = searchParams.get('symbol') || '';
  const date = searchParams.get('date') || '';

  return (
    <AppShell>
      <ExecutionsWorkspace symbol={symbol} date={date} />
    </AppShell>
  );
}
