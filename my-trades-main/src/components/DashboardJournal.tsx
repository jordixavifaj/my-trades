'use client';

import { useCallback, useMemo, useState } from 'react';
import { TradingCalendar } from '@/components/TradingCalendar';
import { JournalChart, JournalCandle, JournalTrade } from '@/components/JournalChart';

type CalendarTrade = {
  id: string;
  symbol: string;
  pnl: number;
  side: 'BUY' | 'SELL';
  quantity: number;
  openDate: string;
  closeDate: string | null;
  status: 'OPEN' | 'CLOSED';
};

export function DashboardJournal({
  days,
  tradesByDay,
}: {
  days: Array<{ date: string; pnl: number }>;
  tradesByDay: Record<string, CalendarTrade[]>;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ date: string; symbol: string } | null>(null);
  const [candles, setCandles] = useState<JournalCandle[]>([]);
  const [trades, setTrades] = useState<JournalTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    if (!selected) return null;
    return `${selected.symbol} · ${selected.date}`;
  }, [selected]);

  async function readJsonSafe(res: Response): Promise<any> {
    const contentType = res.headers.get('content-type') ?? '';
    const text = await res.text();
    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(text);
      } catch {
        return { error: text };
      }
    }

    try {
      return JSON.parse(text);
    } catch {
      return { error: text };
    }
  }

  const handleSymbolSelected = useCallback(async (payload: { date: string; symbol: string }) => {
    setSelected(payload);
    setCandles([]);
    setTrades([]);
    setError(null);
    setLoading(true);

    try {
      const [candlesRes, tradesRes] = await Promise.all([
        fetch(`/api/yahoo/intraday?symbol=${encodeURIComponent(payload.symbol)}&date=${payload.date}`),
        fetch(`/api/dashboard/trades?symbol=${encodeURIComponent(payload.symbol)}&date=${payload.date}`),
      ]);

      const [candlesJson, tradesJson] = await Promise.all([
        readJsonSafe(candlesRes),
        readJsonSafe(tradesRes),
      ]);

      if (!candlesRes.ok) {
        setCandles([]);
        setTrades(tradesJson.trades);
        setError(null);
        return;
      }

      if (!tradesRes.ok) {
        setError(tradesJson.error || tradesJson.detail || 'Error cargando trades del día');
        return;
      }

      setCandles(candlesJson.candles);
      setTrades(tradesJson.trades);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || 'No se pudo procesar el archivo');
        return;
      }

      window.location.reload();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }, []);

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="panel-title">Importar ejecuciones (XLS)</h2>
            <p className="mt-1 text-sm text-slate-400">
              Subir archivo → reconstruir trades → guardar en base de datos → navegar por calendario
            </p>
          </div>
          <div className="w-full lg:max-w-md">
            <label className="relative inline-flex cursor-pointer items-center justify-center rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700">
              {uploading ? 'Procesando...' : 'Subir archivo XLS'}
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
            {uploadError && (
              <p className="mt-2 text-sm text-rose-300">{uploadError}</p>
            )}
          </div>
        </div>
      </section>

      <TradingCalendar
        days={days}
        tradesByDay={tradesByDay}
        onSymbolSelected={handleSymbolSelected}
      />

      <section className="panel p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="panel-title">Gráfico intradía + ejecuciones</h3>
          {title && <span className="text-sm text-slate-400">{title}</span>}
        </div>

        {!selected && (
          <div className="flex h-[600px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60">
            <p className="text-sm text-slate-400">Selecciona un día y luego un ticker para ver el gráfico.</p>
          </div>
        )}

        {selected && loading && (
          <div className="flex h-[600px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
              <p className="text-sm text-slate-400">Cargando datos...</p>
            </div>
          </div>
        )}

        {selected && !loading && error && (
          <div className="flex h-[600px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60">
            <div className="text-center">
              <p className="text-sm font-medium text-rose-300">{error}</p>
            </div>
          </div>
        )}

        {selected && !loading && !error && trades.length > 0 && (
          <JournalChart candles={candles} trades={trades} ticker={selected.symbol} date={selected.date} />
        )}
      </section>
    </div>
  );
}
