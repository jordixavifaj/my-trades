'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { JournalChart, JournalCandle, JournalTrade } from '@/components/JournalChart';

type ApiFill = {
  id: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: string;
  commission: number;
};

type ApiTrade = {
  id: string;
  ticker: string;
  date: string;
  direction: 'LONG' | 'SHORT';
  pnl: number;
  fills: ApiFill[];
};

type ExecRow = {
  id: string;
  tradeId: string;
  kind: 'ENTRY' | 'EXIT';
  time: number;
  ts: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  cumulativeSize: number;
  realizedPnl: number;
};

export function ExecutionsWorkspace({ symbol, date }: { symbol: string; date: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<ApiTrade[]>([]);
  const [candles, setCandles] = useState<JournalCandle[]>([]);

  const load = useCallback(async () => {
    if (!symbol || !date) {
      setTrades([]);
      setCandles([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [candlesRes, tradesRes] = await Promise.all([
        fetch(`/api/yahoo/intraday?symbol=${encodeURIComponent(symbol)}&date=${encodeURIComponent(date)}`, { cache: 'no-store' }),
        fetch(`/api/dashboard/trades?symbol=${encodeURIComponent(symbol)}&date=${encodeURIComponent(date)}`, { cache: 'no-store' }),
      ]);

      const [candlesJson, tradesJson] = await Promise.all([candlesRes.json(), tradesRes.json()]);

      if (!tradesRes.ok) {
        setError(tradesJson.error || tradesJson.detail || 'No se pudieron cargar ejecuciones');
        setTrades([]);
        setCandles([]);
        return;
      }

      if (!candlesRes.ok) {
        setTrades(tradesJson.trades ?? []);
        setCandles([]);
        return;
      }

      setTrades(Array.isArray(tradesJson.trades) ? tradesJson.trades : []);
      setCandles(Array.isArray(candlesJson.candles) ? candlesJson.candles : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
      setTrades([]);
      setCandles([]);
    } finally {
      setLoading(false);
    }
  }, [symbol, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const executions = useMemo((): ExecRow[] => {
    const rows: ExecRow[] = [];

    for (const trade of trades) {
      const fillsSorted = (trade.fills ?? []).slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      if (!fillsSorted.length) continue;

      const isEntrySide = (side: 'BUY' | 'SELL') => (trade.direction === 'LONG' ? side === 'BUY' : side === 'SELL');
      const isExitSide = (side: 'BUY' | 'SELL') => (trade.direction === 'LONG' ? side === 'SELL' : side === 'BUY');

      let pos = 0;
      let avgEntry = 0;
      let realized = 0;

      for (const f of fillsSorted) {
        const kind: 'ENTRY' | 'EXIT' | null = isEntrySide(f.side) ? 'ENTRY' : isExitSide(f.side) ? 'EXIT' : null;
        if (!kind) continue;

        const t = Math.floor(new Date(f.timestamp).getTime() / 1000);

        if (kind === 'ENTRY') {
          const newAbs = Math.abs(pos) + f.quantity;
          avgEntry = newAbs === 0 ? 0 : (avgEntry * Math.abs(pos) + f.price * f.quantity) / newAbs;
          pos = trade.direction === 'LONG' ? pos + f.quantity : pos - f.quantity;
        } else {
          const closeQty = Math.min(Math.abs(pos), f.quantity);
          const gross = trade.direction === 'LONG' ? (f.price - avgEntry) * closeQty : (avgEntry - f.price) * closeQty;
          realized += gross;
          pos = trade.direction === 'LONG' ? pos - closeQty : pos + closeQty;
        }

        rows.push({
          id: f.id,
          tradeId: trade.id,
          kind,
          time: t,
          ts: f.timestamp,
          side: f.side,
          quantity: f.quantity,
          price: f.price,
          cumulativeSize: Math.abs(pos),
          realizedPnl: realized,
        });
      }
    }

    return rows.sort((a, b) => a.time - b.time);
  }, [trades]);

  const journalTrades = useMemo((): JournalTrade[] => {
    return trades.map((t) => ({
      id: t.id,
      ticker: t.ticker,
      date: t.date,
      direction: t.direction,
      entry_time: t.fills?.[0]?.timestamp ?? '',
      entry_price: t.fills?.[0]?.price ?? 0,
      exit_time: t.fills?.[t.fills.length - 1]?.timestamp ?? '',
      exit_price: t.fills?.[t.fills.length - 1]?.price ?? 0,
      size: 0,
      pnl: t.pnl,
      fills: t.fills,
    }));
  }, [trades]);

  const totalRealized = useMemo(() => executions.reduce((acc, e) => acc + (e.kind === 'EXIT' ? e.realizedPnl : 0), 0), [executions]);

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h1 className="text-2xl font-semibold tracking-tight">Ejecuciones</h1>
        <p className="mt-1 text-sm text-slate-400">
          {symbol ? symbol.toUpperCase() : '—'} · {date || '—'} · {executions.length} ejecuciones
        </p>
      </section>

      {loading && (
        <section className="panel p-5">
          <p className="text-sm text-slate-400">Cargando...</p>
        </section>
      )}

      {error && (
        <section className="panel p-5">
          <p className="text-sm font-medium text-rose-300">{error}</p>
        </section>
      )}

      {!loading && !error && executions.length > 0 && (
        <>
          <section className="panel p-5">
            <JournalChart candles={candles} trades={journalTrades} ticker={symbol.toUpperCase()} date={date} />
          </section>
        </>
      )}

      {!loading && !error && executions.length === 0 && symbol && date && (
        <section className="panel p-5">
          <p className="text-sm text-slate-400">No hay ejecuciones para ese día.</p>
        </section>
      )}

      {!symbol || !date ? (
        <section className="panel p-5">
          <p className="text-sm text-slate-400">Falta `symbol` o `date` en la URL.</p>
        </section>
      ) : null}
    </div>
  );
}
