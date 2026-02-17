import { AppShell } from '@/components/AppShell';
import { TradesManager } from '@/components/TradesManager';

export default function TradesPage() {
  return (
    <AppShell>
      <h1 className="mb-4 text-3xl font-bold">Trades</h1>
      <TradesManager />
    </AppShell>
  );
}
