import { prisma } from '@/lib/prisma';

function normalizeSide(side: string): 'BUY' | 'SELL' {
  return side === 'SELL' ? 'SELL' : 'BUY';
}

function normalizeStatus(status: string): 'OPEN' | 'CLOSED' {
  return status === 'CLOSED' ? 'CLOSED' : 'OPEN';
}

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
    const pnlByMonth = new Map<string, number>();
    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    const equityCurve: Array<{ date: string; equity: number; drawdown: number }> = [];

    for (const trade of closedTrades) {
      const tradeDate = trade.closeDate ?? trade.openDate;
      const day = tradeDate.toISOString().slice(0, 10);
      const month = tradeDate.toISOString().slice(0, 7);
      const net = (trade.pnl ?? 0) - trade.commission;

      pnlByDay.set(day, (pnlByDay.get(day) ?? 0) + net);
      pnlByMonth.set(month, (pnlByMonth.get(month) ?? 0) + net);

      equity += net;
      peak = Math.max(peak, equity);
      const drawdown = peak - equity;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      equityCurve.push({ date: day, equity: Number(equity.toFixed(2)), drawdown: Number(drawdown.toFixed(2)) });
    }


    const tradesByDay = trades.reduce<Record<string, Array<{ id: string; symbol: string; pnl: number; side: 'BUY' | 'SELL'; quantity: number; openDate: string; closeDate: string | null; status: 'OPEN' | 'CLOSED' }>>>((acc, trade) => {
      const d = (trade.closeDate ?? trade.openDate).toISOString().slice(0, 10);
      if (!acc[d]) acc[d] = [];
      acc[d].push({
        id: trade.id,
        symbol: trade.symbol,
        pnl: (trade.pnl ?? 0) - trade.commission,
        side: normalizeSide(trade.side),
        quantity: trade.quantity,
        openDate: trade.openDate.toISOString(),
        closeDate: trade.closeDate ? trade.closeDate.toISOString() : null,
        status: normalizeStatus(trade.status),
      });
      return acc;
    }, {});

    const calendarDays = Object.entries(tradesByDay)
      .map(([date, dayTrades]) => {
        const pnl = pnlByDay.get(date) ?? 0;
        return { date, pnl, tradeCount: dayTrades.length };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

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
        maxDrawdown: Number(maxDrawdown.toFixed(2)),
      },
      pnlTimeline: Array.from(pnlByDay.entries()).map(([date, pnl]) => ({ date, pnl })),
      pnlByMonth: Array.from(pnlByMonth.entries()).map(([month, pnl]) => ({ month, pnl })),
      equityCurve,
      strategyPerformance,
      recentTrades: trades.slice(-10).reverse(),
      calendarDays,
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
      calendarDays: [],
      tradesByDay: {},
    };
  }
}
