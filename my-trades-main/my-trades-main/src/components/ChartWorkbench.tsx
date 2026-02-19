'use client';

import { useEffect, useMemo, useState } from 'react';

export interface ChartWorkbenchProps {
  symbol: string;
  day?: string; // opcional
}

export function ChartWorkbench({ symbol, day }: ChartWorkbenchProps) {
  // TODO: pega aquí el resto de tu código de ChartWorkbench
  return <div>Chart placeholder for {symbol} {day && `(${day})`}</div>;
}
