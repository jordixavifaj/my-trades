import { AppShell } from '@/components/AppShell';
import { TradesManager } from '@/components/TradesManager';

export default function TradesPage() {
  return (
    <AppShell>
      <h1 className="mb-4 text-3xl font-semibold tracking-tight">Trades</h1>
      <TradesManager />
    </AppShell>
  );
}
