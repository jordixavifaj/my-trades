import { prisma } from '@/lib/prisma';

export async function getDashboardMetrics(userId?: string) {
  try {
    const trades = await prisma.trade.findMany({
      where: {
        status: 'CLOSED',
        userId: userId ?? undefined,
      },
      orderBy: { closeDate: 'asc' },
      include: { fills: true },
    });

    const totalPnl = trades.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0);
    const wins = trades.filter((trade) => (trade.pnl ?? 0) > 0).length;
    const losses = trades.length - wins;
    const winRate = trades.length ? (wins / trades.length) * 100 : 0;

    const dayMap = new Map<string, { date: string; totalTrades: number; totalPnl: number; trades: typeof trades }>();
    for (const trade of trades) {
      const dt = (trade.closeDate ?? trade.openDate).toISOString().slice(0, 10);
      const existing = dayMap.get(dt);
      if (!existing) {
        dayMap.set(dt, { date: dt, totalTrades: 1, totalPnl: trade.pnl ?? 0, trades: [trade] as any });
      } else {
        existing.totalTrades += 1;
        existing.totalPnl += trade.pnl ?? 0;
        (existing.trades as any).push(trade);
      }
    }

    const calendarDays = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    const equityCurve = trades.map((trade) => {
      equity += trade.pnl ?? 0;
      peak = Math.max(peak, equity);
      const drawdown = peak - equity;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      return {
        date: (trade.closeDate ?? trade.openDate).toISOString().slice(0, 10),
        equity: Number(equity.toFixed(2)),
        drawdown: Number(drawdown.toFixed(2)),
      };
    });

    // Monthly PnL
    const monthMap = new Map<string, number>();
    for (const trade of trades) {
      const dt = (trade.closeDate ?? trade.openDate).toISOString().slice(0, 7); // YYYY-MM
      monthMap.set(dt, (monthMap.get(dt) ?? 0) + (trade.pnl ?? 0));
    }
    const pnlByMonth = Array.from(monthMap.entries())
      .map(([month, pnl]) => ({ month, pnl: Number(pnl.toFixed(2)) }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const strategyPerformance = [{ name: 'XLS', trades: trades.length, pnl: Number(totalPnl.toFixed(2)) }];
    const tradesByDay = Object.fromEntries(
      calendarDays.map((day) => [
        day.date,
        (day.trades as any).map((trade: any) => ({
          id: trade.id,
          symbol: trade.symbol,
          pnl: trade.pnl ?? 0,
          side: trade.side === 'BUY' ? ('BUY' as const) : ('SELL' as const),
          quantity: trade.quantity,
          openDate: trade.openDate.toISOString(),
          closeDate: (trade.closeDate ?? trade.openDate).toISOString(),
          setupName: trade.setupName ?? null,
          status: 'CLOSED' as const,
        })),
      ]),
    );

    return {
      summary: {
        totalTrades: trades.length,
        closedTrades: trades.length,
        openTrades: 0,
        wins,
        losses,
        winRate: Number(winRate.toFixed(2)),
        totalPnl: Number(totalPnl.toFixed(2)),
        maxDrawdown: Number(maxDrawdown.toFixed(2)),
      },
      pnlTimeline: calendarDays.map((day) => ({ date: day.date, pnl: Number(day.totalPnl.toFixed(2)) })),
      pnlByMonth,
      equityCurve,
      strategyPerformance,
      recentTrades: trades.slice(-10).reverse(),
      tradesByDay,
    };
  } catch {
    return {
      summary: { totalTrades: 0, closedTrades: 0, openTrades: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0, maxDrawdown: 0 },
      pnlTimeline: [],
      pnlByMonth: [],
      equityCurve: [],
      strategyPerformance: [],
      recentTrades: [],
      tradesByDay: {},
    };
  }
}
