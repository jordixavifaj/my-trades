'use client';

import { useState } from 'react';
import { ChartWorkbench } from '@/components/ChartWorkbench';
import { AppShell } from '@/components/AppShell';

type TickerData = Record<string, any>;

export default function ChartLabPage() {
  const [tickerInput, setTickerInput] = useState('');
  const [ticker, setTicker] = useState('');
  const [data, setData] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const t = tickerInput.trim().toUpperCase();
    if (!t) {
      setError('Escribe un ticker');
      return;
    }
    setLoading(true);
    setError(null);
    console.log(`Searching for ticker: ${t}`);
    try {
      const url = `/api/ticker?ticker=${encodeURIComponent(t)}`;
      console.log(`Fetching from: ${url}`);
      const res = await fetch(url);
      console.log(`Response status: ${res.status}`);
      
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        console.error(`Error response:`, payload);
        throw new Error(payload?.error || `Error ${res.status}`);
      }
      const payload = await res.json();
      console.log(`Response payload:`, payload);
      setTicker(t);
      setData(payload.data);
    } catch (e) {
      console.error(`Search error:`, e);
      setError(e instanceof Error ? e.message : 'Error');
      setData(null);
      setTicker('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <section className="panel p-5">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Chart Lab</h1>
        <p className="text-sm text-slate-400">Busca un ticker para ver datos fundamentales y un gráfico interactivo.</p>
      </div>

      {/* Search */}
      <div className="mb-6 flex gap-2">
        <input
          type="text"
          placeholder="Ej: AAPL, TSLA, RENN..."
          value={tickerInput}
          onChange={(e) => setTickerInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="rounded-lg border border-cyan-400 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200 disabled:opacity-50"
        >
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}

      {/* Ticker Info Cards */}
      {ticker && data && (
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">{ticker} · Información</h2>
            <div className="text-xs text-slate-400">
              Fuente: {data.price ? 'Yahoo Finance' : data.company ? 'Polygon' : 'Finviz'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-xs text-slate-400">Ticker</p>
              <p className="text-lg font-semibold text-slate-200">{ticker}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-xs text-slate-400">Empresa</p>
              <p className="text-sm font-medium text-slate-200 truncate">{data.company || data.Company || '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-xs text-slate-400">Sector</p>
              <p className="text-sm font-medium text-slate-200 truncate">{data.sector || data.Sector || data.industry || data.Industry || '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-xs text-slate-400">Market Cap</p>
              <p className="text-sm font-medium text-slate-200 truncate">{data.marketCap || data['Market Cap'] || '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-xs text-slate-400">Float</p>
              <p className="text-sm font-medium text-slate-200 truncate">{typeof data.float === 'number' ? data.float.toLocaleString() : data.float || data.Float || data['Float Shs'] || '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-xs text-slate-400">Insider Own %</p>
              <p className="text-sm font-medium text-slate-200 truncate">{data.insiderOwnershipPercent || data['Insider Ownership %'] || data['Insider Own'] || '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="text-xs text-slate-400">Short Interest %</p>
              <p className="text-sm font-medium text-slate-200 truncate">{data.shortInterestPercent || data['Short Interest %'] || data['Short Interest / Float'] || '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {ticker && (
        <div>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">{ticker} · Gráfico</h2>
          <ChartWorkbench symbol={ticker} />
        </div>
      )}
      </section>
    </AppShell>
  );
}
