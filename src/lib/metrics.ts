import { prisma } from '@/lib/prisma';

export async function getDashboardMetrics() {
  try {
    const trades = await prisma.trade.findMany({
      orderBy: { openDate: 'asc' },
      include: { strategy: true },
    });

    const closedTrades = trades.filter((t) => t.status === 'CLOSED' && t.pnl !== null);
    const totalPnl = closedTrades.reduce((acc, trade) => acc + (trade.pnl ?? 0) - trade.commission, 0);
    const wins = closedTrades.filter((trade) => (trade.pnl ?? 0) > 0).length;
    const losses = closedTrades.filter((trade) => (trade.pnl ?? 0) <= 0).length;
    const winRate = closedTrades.length ? (wins / closedTrades.length) * 100 : 0;

    const pnlByDay = new Map<string, number>();
    for (const trade of closedTrades) {
      const day = (trade.closeDate ?? trade.openDate).toISOString().slice(0, 10);
      pnlByDay.set(day, (pnlByDay.get(day) ?? 0) + (trade.pnl ?? 0) - trade.commission);
    }

    const strategyPerformance = Array.from(
      trades
        .reduce((acc, trade) => {
          const key = trade.strategy?.name ?? 'Sin estrategia';
          const current = acc.get(key) ?? { name: key, trades: 0, pnl: 0 };
          current.trades += 1;
          current.pnl += (trade.pnl ?? 0) - trade.commission;
          acc.set(key, current);
          return acc;
        }, new Map<string, { name: string; trades: number; pnl: number }>())
        .values(),
    );

    return {
      summary: {
        totalTrades: trades.length,
        closedTrades: closedTrades.length,
        openTrades: trades.length - closedTrades.length,
        wins,
        losses,
        winRate: Number(winRate.toFixed(2)),
        totalPnl: Number(totalPnl.toFixed(2)),
      },
      pnlTimeline: Array.from(pnlByDay.entries()).map(([date, pnl]) => ({ date, pnl })),
      strategyPerformance,
      recentTrades: trades.slice(-10).reverse(),
    };
  } catch {
    return {
      summary: { totalTrades: 0, closedTrades: 0, openTrades: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0 },
      pnlTimeline: [],
      strategyPerformance: [],
      recentTrades: [],
    };
  }
}
