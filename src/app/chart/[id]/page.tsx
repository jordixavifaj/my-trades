import { AppShell } from '@/components/AppShell';
import { ChartWorkbench } from '@/components/ChartWorkbench';

export default function ChartDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <ChartWorkbench symbol={params.id} />
    </AppShell>
  );
}
