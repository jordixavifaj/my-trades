export function TradingCalendar({
  days,
}: {
  days: Array<{ date: string; pnl: number }>;
}) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-4 text-lg font-semibold">Calendario de P&L</h3>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
        {days.slice(-28).map((day) => (
          <div
            key={day.date}
            className={`rounded p-2 text-center text-xs ${day.pnl >= 0 ? 'bg-emerald-600/25 text-emerald-300' : 'bg-rose-600/25 text-rose-300'}`}
          >
            <div>{day.date.slice(5)}</div>
            <div className="font-semibold">{day.pnl.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
