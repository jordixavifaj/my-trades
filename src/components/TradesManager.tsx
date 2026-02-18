'use client';

import { useCallback, useEffect, useState } from 'react';

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
  notes: string | null;
  fills: Fill[];
};


export function TradesManager() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [symbol, setSymbol] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (symbol) query.set('symbol', symbol);
    if (status) query.set('status', status);
    const response = await fetch(`/api/trades?${query.toString()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const result = await response.json();
    setTrades(result.items);
    setPages(result.pages || 1);
  }, [page, status, symbol]);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <>
      <form className="mb-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); }}>
        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" placeholder="Símbolo" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
        <select className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option><option value="OPEN">OPEN</option><option value="CLOSED">CLOSED</option>
        </select>
        <button className="rounded-lg bg-cyan-500 px-3 py-2 text-slate-950 font-medium" type="submit">Filtrar</button>
      </form>

      <form id="create-trade-form" className="mb-6 grid gap-2 panel p-3 md:grid-cols-5" onSubmit={(e) => { e.preventDefault(); createTrade(new FormData(e.currentTarget)); }}>
        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="symbol" placeholder="Symbol" required />
        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="openDate" type="datetime-local" required />
        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="openPrice" type="number" step="0.0001" required />
        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="quantity" type="number" required />
        <select className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="side" defaultValue="BUY"><option>BUY</option><option>SELL</option></select>
        <select className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="status" defaultValue="OPEN"><option>OPEN</option><option>CLOSED</option></select>
        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="commission" type="number" step="0.01" defaultValue="0" />
        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="pnl" type="number" step="0.01" placeholder="PnL (opcional)" />
        <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="notes" placeholder="Notas" />
        <button className="rounded-lg bg-emerald-500 px-3 py-2 text-slate-950 font-medium" type="submit">Crear trade</button>
      </form>

      <div className="space-y-4">
        {trades.map((trade) => (
          <div key={trade.id} className="panel p-3">
            <form className="grid gap-2 md:grid-cols-6" onSubmit={(e) => { e.preventDefault(); updateTrade(trade.id, new FormData(e.currentTarget)); }}>
              <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="symbol" defaultValue={trade.symbol} />
              <select className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="status" defaultValue={trade.status}><option>OPEN</option><option>CLOSED</option></select>
              <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="openPrice" type="number" step="0.0001" defaultValue={trade.openPrice} />
              <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="quantity" type="number" defaultValue={trade.quantity} />
              <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="commission" type="number" step="0.01" defaultValue={trade.commission} />
              <div className="flex gap-2">
                <button className="rounded-lg bg-cyan-500 px-3 py-2 text-slate-950 font-medium" type="submit">Guardar</button>
                <button className="rounded-lg bg-rose-500 px-3 py-2 text-slate-950 font-medium" type="button" onClick={() => deleteTrade(trade.id)}>Eliminar</button>
              </div>
            </form>

            <form className="mt-3 grid gap-2 md:grid-cols-6" onSubmit={(e) => { e.preventDefault(); createFill(trade.id, new FormData(e.currentTarget)); e.currentTarget.reset(); }}>
              <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="symbol" placeholder="Fill symbol" defaultValue={trade.symbol} required />
              <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="price" type="number" step="0.0001" placeholder="Price" required />
              <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="quantity" type="number" placeholder="Qty" required />
              <select className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="side" defaultValue={trade.side}><option>BUY</option><option>SELL</option></select>
              <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="timestamp" type="datetime-local" required />
              <button className="rounded-lg bg-emerald-500 px-3 py-2 text-slate-950 font-medium" type="submit">Añadir fill</button>
            </form>

            <div className="mt-3 space-y-2">
              {trade.fills.map((fill) => (
                <form key={fill.id} className="grid gap-2 md:grid-cols-6" onSubmit={(e) => { e.preventDefault(); updateFill(fill.id, new FormData(e.currentTarget)); }}>
                  <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="symbol" defaultValue={fill.symbol} />
                  <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="price" type="number" step="0.0001" defaultValue={fill.price} />
                  <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="quantity" type="number" defaultValue={fill.quantity} />
                  <select className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="side" defaultValue={fill.side}><option>BUY</option><option>SELL</option></select>
                  <input className="rounded-lg border border-slate-700 bg-slate-900/80 p-2" name="commission" type="number" step="0.01" defaultValue={fill.commission} />
                  <div className="flex gap-2">
                    <button className="rounded-lg bg-cyan-500 px-3 py-2 text-slate-950 font-medium" type="submit">Guardar fill</button>
                    <button className="rounded-lg bg-rose-500 px-3 py-2 text-slate-950 font-medium" type="button" onClick={() => deleteFill(fill.id)}>Eliminar</button>
                  </div>
                </form>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span>Página {page}/{pages}</span>
        <button className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} type="button">Anterior</button>
        <button className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} type="button">Siguiente</button>
      </div>

      {message && <p className="mt-3 rounded-lg border border-slate-700 bg-slate-900/80 p-2 text-sm">{message}</p>}
    </>
  );
}
