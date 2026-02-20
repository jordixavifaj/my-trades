'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MiniChart } from './MiniChart';

type SetupItem = {
  id: string;
  name: string;
  side: string;
  phase: string;
  summary: string;
};

type Fill = {
  id: string;
  symbol: string;
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  timestamp: string;
  commission: number;
};

type Trade = {
  id: string;
  symbol: string;
  status: 'OPEN' | 'CLOSED';
  openDate: string;
  closeDate: string | null;
  openPrice: number;
  closePrice: number | null;
  quantity: number;
  side: 'BUY' | 'SELL';
  pnl: number | null;
  commission: number;
  setupName?: string | null;
  setupSource?: string | null;
  notes: string | null;
  fills: Fill[];
};

export function TradesManager() {
  const router = useRouter();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [setups, setSetups] = useState<SetupItem[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [symbol, setSymbol] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [message, setMessage] = useState('');
  const [isCleaning, setIsCleaning] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [chartData, setChartData] = useState<Record<string, { candles: any[], overlays: any[] }>>({});

  const handleSymbolClick = (symbol: string, date?: string) => {
    if (date) {
      router.push(`/executions?symbol=${encodeURIComponent(symbol.toUpperCase())}&date=${encodeURIComponent(date)}`);
      return;
    }
    router.push(`/chart?symbol=${encodeURIComponent(symbol.toUpperCase())}`);
  };

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (symbol) query.set('symbol', symbol);
    if (status) query.set('status', status);
    const response = await fetch(`/api/trades?${query.toString()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const result = await response.json();
    setTrades(result.items);
    setPages(result.pages || 1);
    
    const newChartData: Record<string, { candles: any[], overlays: any[] }> = {};
    result.items.forEach((trade: any) => {
      if (!newChartData[trade.symbol]) {
        newChartData[trade.symbol] = { candles: [], overlays: [] };
      }
      newChartData[trade.symbol].overlays.push(trade);
    });
    setChartData(newChartData);
  }, [page, status, symbol]);

  const loadSetups = useCallback(async () => {
    try {
      const res = await fetch('/api/setups', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setSetups(Array.isArray(json.items) ? json.items : []);
    } catch {
      setSetups([]);
    }
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        date: string;
        symbol: string;
        trades: Trade[];
        pnlNet: number;
      }
    >();

    for (const t of trades) {
      const dt = (t.closeDate ?? t.openDate).slice(0, 10);
      const sym = t.symbol.toUpperCase();
      const key = `${dt}::${sym}`;
      const pnl = t.pnl ?? 0;
      const existing = map.get(key);
      if (existing) {
        existing.trades.push(t);
        existing.pnlNet += pnl;
      } else {
        map.set(key, { key, date: dt, symbol: sym, trades: [t], pnlNet: pnl });
      }
    }

    return Array.from(map.values()).sort((a, b) => (b.date + b.symbol).localeCompare(a.date + a.symbol));
  }, [trades]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadSetups();
  }, [loadSetups]);

  const updateSetup = useCallback(async (tradeId: string, setupName: string) => {
    try {
      const res = await fetch(`/api/trades/${tradeId}/setup`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupName, setupSource: 'MANUAL' }),
      });
      if (!res.ok) {
        setMessage('No se pudo guardar el setup');
        return;
      }
      const updated = await res.json();
      setTrades((prev) => prev.map((t) => (t.id === tradeId ? { ...t, setupName: updated.setupName, setupSource: updated.setupSource } : t)));
      setMessage('Setup guardado');
    } catch {
      setMessage('Error guardando setup');
    }
  }, []);

  const updateGroupSetup = useCallback(
    async (groupKey: string, setupName: string) => {
      const group = grouped.find((g) => g.key === groupKey);
      if (!group) return;

      await Promise.all(group.trades.map((t) => updateSetup(t.id, setupName)));

      setTrades((prev) =>
        prev.map((t) =>
          group.trades.some((gt) => gt.id === t.id)
            ? { ...t, setupName: setupName || null, setupSource: setupName ? 'MANUAL' : null }
            : t,
        ),
      );
    },
    [grouped, updateSetup],
  );

  async function createTrade(formData: FormData) {
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch('/api/trades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setMessage(response.ok ? 'Trade creado' : 'Error creando trade');
    if (response.ok) {
      (document.getElementById('create-trade-form') as HTMLFormElement)?.reset();
      await load();
    }
  }

  async function updateTrade(id: string, formData: FormData) {
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch(`/api/trades/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setMessage(response.ok ? 'Trade actualizado' : 'Error actualizando trade');
    if (response.ok) await load();
  }

  async function deleteTrade(id: string) {
    const response = await fetch(`/api/trades/${id}`, { method: 'DELETE' });
    setMessage(response.ok ? 'Trade eliminado' : 'No se pudo eliminar trade (requiere admin)');
    if (response.ok) await load();
  }

  async function createFill(tradeId: string, formData: FormData) {
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch('/api/fills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, tradeId }) });
    setMessage(response.ok ? 'Fill creado' : 'Error creando fill');
    if (response.ok) await load();
  }

  async function updateFill(id: string, formData: FormData) {
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch(`/api/fills/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setMessage(response.ok ? 'Fill actualizado' : 'Error actualizando fill');
    if (response.ok) await load();
  }

  async function deleteFill(id: string) {
    const response = await fetch(`/api/fills/${id}`, { method: 'DELETE' });
    setMessage(response.ok ? 'Fill eliminado' : 'No se pudo eliminar fill (requiere admin)');
    if (response.ok) await load();
  }

  async function cleanupDuplicates() {
    if (isCleaning) return;
    
    if (!confirm('¿Estás seguro de que quieres eliminar trades duplicados? Esta acción no se puede deshacer.')) {
      return;
    }

    setIsCleaning(true);
    try {
      const response = await fetch('/api/trades/cleanup', { method: 'POST' });
      const result = await response.json();
      
      if (response.ok) {
        setMessage(`${result.message}. Total antes: ${result.totalBefore}, Total después: ${result.totalAfter}`);
        await load();
      } else {
        setMessage(result.error || 'Error limpiando trades duplicados');
      }
    } catch (error) {
      setMessage('Error de conexión al limpiar trades duplicados');
    } finally {
      setIsCleaning(false);
    }
  }

  async function deleteAllTrades() {
    if (isDeletingAll) return;
    
    if (!confirm('⚠️ ¡ADVERTENCIA! ¿Estás seguro de que quieres eliminar TODOS los trades? Esta acción eliminará permanentemente todos tus trades y no se puede deshacer.')) {
      return;
    }

    if (!confirm('¿Estás ABSOLUTAMENTE seguro? Esta acción borrará todos tus trades y fills permanentemente.')) {
      return;
    }

    setIsDeletingAll(true);
    try {
      const response = await fetch('/api/trades/delete-all', { method: 'POST' });
      const result = await response.json();
      
      if (response.ok) {
        setMessage(`${result.message}. Se eliminaron ${result.deletedCount} trades.`);
        setTrades([]);
        setPage(1);
      } else {
        setMessage(result.error || 'Error eliminando todos los trades');
      }
    } catch (error) {
      setMessage('Error de conexión al eliminar trades');
    } finally {
      setIsDeletingAll(false);
    }
  }

  return (
    <>
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
        }}
      >
        <input
          className="rounded-lg border border-slate-700 bg-slate-900/80 p-2"
          placeholder="Símbolo"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
        />
        <select
          className="rounded-lg border border-slate-700 bg-slate-900/80 p-2"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos</option>
          <option value="OPEN">OPEN</option>
          <option value="CLOSED">CLOSED</option>
        </select>
        <button className="rounded-lg bg-cyan-500 px-3 py-2 text-slate-950 font-medium" type="submit">
          Filtrar
        </button>
        <button
          className="rounded-lg bg-amber-500 px-3 py-2 text-slate-950 font-medium disabled:opacity-50"
          type="button"
          onClick={cleanupDuplicates}
          disabled={isCleaning}
        >
          {isCleaning ? 'Limpiando...' : 'Limpiar Duplicados'}
        </button>
        <button
          className="rounded-lg bg-red-600 px-3 py-2 text-white font-medium disabled:opacity-50"
          type="button"
          onClick={deleteAllTrades}
          disabled={isDeletingAll}
        >
          {isDeletingAll ? 'Borrando...' : 'Borrar Todo'}
        </button>
      </form>

      <form
        id="create-trade-form"
        className="mb-6 grid gap-2 panel p-3 md:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          createTrade(new FormData(e.currentTarget));
        }}
      >
        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="symbol" placeholder="Symbol" required />
        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="openDate" type="datetime-local" required />
        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="openPrice" type="number" step="0.0001" required />
        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="quantity" type="number" required />
        <select className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="side" defaultValue="BUY">
          <option>BUY</option>
          <option>SELL</option>
        </select>
        <select className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="status" defaultValue="OPEN">
          <option>OPEN</option>
          <option>CLOSED</option>
        </select>
        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="commission" type="number" step="0.01" defaultValue="0" />
        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="pnl" type="number" step="0.01" placeholder="PnL (opcional)" />
        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="notes" placeholder="Notas" />
        <button className="rounded-lg bg-emerald-500 px-3 py-2 text-slate-950 font-medium" type="submit">
          Crear trade
        </button>
      </form>

      <div className="space-y-4">
        {grouped.map((group) => {
          const isExpanded = Boolean(expandedGroups[group.key]);
          const groupSetup = group.trades.find((t) => (t.setupName ?? '').length)?.setupName ?? '';
          return (
            <div key={group.key} className="panel p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleSymbolClick(group.symbol, group.date)}
                    className="text-lg font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                    type="button"
                  >
                    {group.symbol}
                  </button>
                  <span className="text-sm text-slate-400">{group.date}</span>
                  <MiniChart
                    symbol={group.symbol}
                    candles={chartData[group.symbol]?.candles || []}
                    overlays={chartData[group.symbol]?.overlays || []}
                    width={200}
                    height={60}
                    onClick={() => handleSymbolClick(group.symbol)}
                  />

                  <select
                    className="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1.5 text-xs text-slate-200"
                    value={groupSetup}
                    onChange={(e) => updateGroupSetup(group.key, e.target.value)}
                  >
                    <option value="">Setup</option>
                    {setups.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${group.pnlNet >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    Net: {group.pnlNet.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-500">{group.trades.length} trades</span>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200"
                    onClick={() =>
                      setExpandedGroups((prev) => ({
                        ...prev,
                        [group.key]: !isExpanded,
                      }))
                    }
                  >
                    {isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-4">
                  {group.trades.map((trade) => (
                    <div key={trade.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs text-slate-400">Trade ID: {trade.id}</span>
                        <span className="text-xs text-slate-400">
                          {trade.status} · PnL: {trade.pnl ? trade.pnl.toFixed(2) : 'N/A'}
                        </span>
                      </div>

                      <div className="mb-2 grid gap-2 md:grid-cols-3">
                        <label className="text-xs text-slate-400">
                          Setup
                          <select
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 p-2 text-sm"
                            value={trade.setupName ?? ''}
                            onChange={(e) => updateSetup(trade.id, e.target.value)}
                          >
                            <option value="">Sin setup</option>
                            {setups.map((s) => (
                              <option key={s.id} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="hidden md:block" />
                        <div className="hidden md:block" />
                      </div>

                      <form
                        className="grid gap-2 md:grid-cols-6"
                        onSubmit={(e) => {
                          e.preventDefault();
                          updateTrade(trade.id, new FormData(e.currentTarget));
                        }}
                      >
                        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="symbol" defaultValue={trade.symbol} />
                        <select className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="status" defaultValue={trade.status}>
                          <option>OPEN</option>
                          <option>CLOSED</option>
                        </select>
                        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="openPrice" type="number" step="0.0001" defaultValue={trade.openPrice} />
                        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="quantity" type="number" defaultValue={trade.quantity} />
                        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="commission" type="number" step="0.01" defaultValue={trade.commission} />
                        <div className="flex gap-2">
                          <button className="rounded-lg bg-cyan-500 px-3 py-2 text-slate-950 font-medium" type="submit">
                            Guardar
                          </button>
                          <button
                            className="rounded-lg bg-rose-500 px-3 py-2 text-slate-950 font-medium"
                            type="button"
                            onClick={() => deleteTrade(trade.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span>
          Página {page}/{pages}
        </span>
        <button
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          type="button"
        >
          Anterior
        </button>
        <button
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 disabled:opacity-40"
          disabled={page >= pages}
          onClick={() => setPage((p) => p + 1)}
          type="button"
        >
          Siguiente
        </button>
      </div>

      {message && <p className="mt-3 rounded-lg border border-slate-700 bg-slate-900/80 p-2 text-sm">{message}</p>}
    </>
  );
}
