import { AppShell } from '@/components/AppShell';
import { ChartLabWorkspace } from '@/components/ChartLabWorkspace';

export default function ChartDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <ChartLabWorkspace initialSymbol={params.id} />
    </AppShell>
  );
}
