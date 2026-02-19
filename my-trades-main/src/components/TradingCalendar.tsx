'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

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

type StockSummary = {
  symbol: string;
  totalPnL: number;
  tradesCount: number;
  trades: CalendarTrade[];
};

export function TradingCalendar({ days, tradesByDay }: { days: Array<{ date: string; pnl: number }>; tradesByDay: Record<string, CalendarTrade[]> }) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Group trades by symbol for selected day
  const stockSummaries = useMemo(() => {
    if (!selectedDay) return [];
    
    const trades = tradesByDay[selectedDay] ?? [];
    const grouped = new Map<string, StockSummary>();
    
    trades.forEach(trade => {
      const existing = grouped.get(trade.symbol);
      if (existing) {
        existing.totalPnL += trade.pnl;
        existing.tradesCount += 1;
        existing.trades.push(trade);
      } else {
        grouped.set(trade.symbol, {
          symbol: trade.symbol,
          totalPnL: trade.pnl,
          tradesCount: 1,
          trades: [trade]
        });
      }
    });
    
    return Array.from(grouped.values()).sort((a, b) => Math.abs(b.totalPnL) - Math.abs(a.totalPnL));
  }, [selectedDay, tradesByDay]);

  const handleSymbolClick = (symbol: string) => {
    router.push(`/chart?symbol=${encodeURIComponent(symbol.toUpperCase())}`);
  };

  const calendarGrid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const items: Array<{ date: string; day: number; inMonth: boolean; pnl: number; trades: number }> = [];

    for (let i = 0; i < startOffset; i += 1) items.push({ date: `off-${i}`, day: 0, inMonth: false, pnl: 0, trades: 0 });

    const map = new Map(days.map((d) => [d.date, d.pnl]));
    const tradeCounts = new Map(Object.entries(tradesByDay).map(([date, trades]) => [date, trades.length]));
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dt = new Date(Date.UTC(year, month, day));
      const date = dt.toISOString().slice(0, 10);
      items.push({ date, day, inMonth: true, pnl: map.get(date) ?? 0, trades: tradeCounts.get(date) ?? 0 });
    }

    while (items.length % 7 !== 0) {
      items.push({ date: `off-end-${items.length}`, day: 0, inMonth: false, pnl: 0, trades: 0 });
    }

    return items;
  }, [cursor, days, tradesByDay]);

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
                      : 'border-slate-800 bg-slate-950/70 hover:bg-slate-800/60'
            }`}
          >
            {item.inMonth && (
              <>
                <p className="text-xs text-slate-300">{item.day}</p>
                <p className={`mt-1 text-xs font-medium ${item.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{item.pnl.toFixed(0)}</p>
                <p className="text-[10px] text-slate-400">{item.trades} trades</p>
              </>
            )}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <h4 className="mb-3 text-sm font-semibold text-slate-200">{selectedDay ? `Resumen de operaciones - ${selectedDay}` : 'Selecciona un día'}</h4>
        <div className="space-y-2">
          {stockSummaries.map((summary) => (
            <div 
              key={summary.symbol} 
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm cursor-pointer hover:bg-slate-800/80 transition-colors"
              onClick={() => handleSymbolClick(summary.symbol)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <button className="font-medium text-cyan-400 hover:text-cyan-300 transition-colors">
                    {summary.symbol}
                  </button>
                  <span className="text-xs text-slate-400">
                    {summary.tradesCount} {summary.tradesCount === 1 ? 'trade' : 'trades'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Click para ver gráfico de ejecuciones
                </p>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${summary.totalPnL >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {summary.totalPnL >= 0 ? '+' : ''}{summary.totalPnL.toFixed(2)}
                </p>
              </div>
            </div>
          ))}
          {selectedDay && stockSummaries.length === 0 && (
            <p className="text-sm text-slate-400">No hubo operaciones registradas.</p>
          )}
        </div>
      </div>
    </section>
  );
}
