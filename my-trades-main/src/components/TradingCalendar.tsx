'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

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

export function TradingCalendar({ days, tradesByDay }: { days: Array<{ date: string; pnl: number; tradeCount: number }>; tradesByDay: Record<string, CalendarTrade[]> }) {
  const [cursor, setCursor] = useState(() => {
    const last = days
      .filter((d) => d.tradeCount > 0)
      .map((d) => d.date)
      .sort((a, b) => a.localeCompare(b))
      .at(-1);

    if (last) {
      const match = last.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const y = Number.parseInt(match[1], 10);
        const m = Number.parseInt(match[2], 10);

        if (Number.isFinite(y) && Number.isFinite(m) && y >= 2000 && y <= 2100 && m >= 1 && m <= 12) {
          return new Date(y, m - 1, 1);
        }
      }
    }

    return new Date(2026, 0, 1); // Enero 2026 como fecha por defecto
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const calendarGrid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const items: Array<{ date: string; day: number; inMonth: boolean; pnl: number; tradeCount: number }> = [];

    for (let i = 0; i < startOffset; i += 1) items.push({ date: `off-${i}`, day: 0, inMonth: false, pnl: 0, tradeCount: 0 });

    const map = new Map(days.map((d) => [d.date, { pnl: d.pnl, tradeCount: d.tradeCount }]));
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dt = new Date(Date.UTC(year, month, day));
      const date = dt.toISOString().slice(0, 10);
      const info = map.get(date);
      items.push({ date, day, inMonth: true, pnl: info?.pnl ?? 0, tradeCount: info?.tradeCount ?? 0 });
    }

    while (items.length % 7 !== 0) {
      items.push({ date: `off-end-${items.length}`, day: 0, inMonth: false, pnl: 0, tradeCount: 0 });
    }

    return items;
  }, [cursor, days]);

  const activeTrades = selectedDay ? tradesByDay[selectedDay] ?? [] : [];

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="panel-title">Calendar</h3>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-slate-700 px-2 py-1 text-xs" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            ←
          </button>
          <span className="text-sm text-slate-300">
            {cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </span>
          <button className="rounded-lg border border-slate-700 px-2 py-1 text-xs" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-400">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {calendarGrid.map((item) => (
          <button
            key={item.date}
            type="button"
            disabled={!item.inMonth}
            onClick={() => item.inMonth && setSelectedDay(item.date)}
            className={`h-20 rounded-xl border p-2 text-left transition ${
              !item.inMonth
                ? 'border-transparent bg-transparent'
                : selectedDay === item.date
                  ? 'border-cyan-400/70 bg-cyan-500/10'
                  : item.pnl > 0
                    ? 'border-emerald-700/60 bg-emerald-500/10 hover:bg-emerald-500/20'
                    : item.pnl < 0
                      ? 'border-rose-700/60 bg-rose-500/10 hover:bg-rose-500/20'
                      : item.tradeCount > 0
                        ? 'border-slate-700 bg-slate-900/60 hover:bg-slate-800/60'
                        : 'border-slate-800 bg-slate-950/70 hover:bg-slate-800/60'
            }`}
          >
            {item.inMonth && (
              <>
                <p className="text-xs text-slate-300">{item.day}</p>
                {item.tradeCount > 0 && <p className="mt-2 text-xs text-slate-400">{item.tradeCount} ops</p>}
                <p className={`mt-1 text-xs font-medium ${item.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{item.pnl.toFixed(0)}</p>
              </>
            )}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <h4 className="mb-3 text-sm font-semibold text-slate-200">{selectedDay ? `Operaciones de ${selectedDay}` : 'Selecciona un día'}</h4>
        <div className="space-y-2">
          {activeTrades.map((trade) => (
            <div key={trade.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-sm">
              <div>
                <p className="font-medium">
                  {selectedDay ? (
                    <Link href={`/chart/${encodeURIComponent(trade.symbol)}?day=${encodeURIComponent(selectedDay)}`} className="hover:underline">
                      {trade.symbol}
                    </Link>
                  ) : (
                    trade.symbol
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  {trade.side} · {trade.quantity} · {trade.status}
                </p>
              </div>
              <p className={trade.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{trade.pnl.toFixed(2)}</p>
            </div>
          ))}
          {selectedDay && activeTrades.length === 0 && <p className="text-sm text-slate-400">No hubo operaciones registradas.</p>}
        </div>
      </div>
    </section>
  );
}
