import { AppShell } from '@/components/AppShell';
import { ChartWorkbench } from '@/components/ChartWorkbench';

export default function ChartDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: { day?: string } }) {
  return (
    <AppShell>
      <ChartWorkbench symbol={params.id} day={searchParams?.day} />
    </AppShell>
  );
}
