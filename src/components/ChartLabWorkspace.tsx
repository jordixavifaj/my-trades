'use client';

import { FormEvent, useEffect, useState } from 'react';

import { InternalTradingFundamentals } from '@/types/fundamentals';

import { ChartWorkbench } from './ChartWorkbench';
import { FundamentalsPanel } from './FundamentalsPanel';

export function ChartLabWorkspace({ initialSymbol }: { initialSymbol: string }) {
  const [symbol, setSymbol] = useState(initialSymbol.toUpperCase());
  const [inputValue, setInputValue] = useState(initialSymbol.toUpperCase());
  const [fundamentals, setFundamentals] = useState<InternalTradingFundamentals | null>(null);
  const [loadingFundamentals, setLoadingFundamentals] = useState(false);
  const [fundamentalsError, setFundamentalsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingFundamentals(true);
    setFundamentalsError(null);

    fetch(`/api/fundamentals/${encodeURIComponent(symbol)}`)
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? 'Unable to load fundamentals.');
        }
        return response.json() as Promise<InternalTradingFundamentals>;
      })
      .then((data) => {
        if (cancelled) return;
        setFundamentals(data);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setFundamentals(null);
        setFundamentalsError(error.message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingFundamentals(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = inputValue.trim().toUpperCase();
    if (!next) return;
    setSymbol(next);
  };

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
          <label htmlFor="ticker-search" className="text-sm text-slate-300">
            Ticker
          </label>
          <input
            id="ticker-search"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value.toUpperCase())}
            placeholder="e.g. AAPL"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/70 transition focus:ring-2"
          />
          <button
            type="submit"
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20"
          >
            Load
          </button>
        </form>
      </section>

      <ChartWorkbench symbol={symbol} />

      <FundamentalsPanel fundamentals={fundamentals} loading={loadingFundamentals} error={fundamentalsError} />
    </div>
  );
}
