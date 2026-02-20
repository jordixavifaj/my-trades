'use client';

import { TickerLab } from '@/components/TickerLab';

export function ChartLabWorkspace({ initialSymbol }: { initialSymbol: string }) {
  return (
    <TickerLab initialSymbol={initialSymbol} />
  );
}
