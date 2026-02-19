import { prisma } from '@/lib/prisma';
import { buildTradesFromExecutions, groupTradesByDay } from '@/lib/trade-builder';
import { Execution } from '@/lib/executions-parser';

export async function getDashboardMetrics() {
  try {
    const fills = await prisma.fill.findMany({ orderBy: { timestamp: 'asc' } });
    const executions: Execution[] = fills.map((fill) => ({
      account: 'DEFAULT',
      symbol: fill.symbol,
      side: fill.side === 'SELL' ? 'SELL' : 'BUY',
      quantity: fill.quantity,
      price: fill.price,
      timestamp: fill.timestamp,
      commission: fill.commission,
    }));

    const trades = buildTradesFromExecutions(executions);
    const calendarDays = groupTradesByDay(trades);
    const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
    const wins = trades.filter((trade) => trade.pnl > 0).length;
    const losses = trades.length - wins;
    const winRate = trades.length ? (wins / trades.length) * 100 : 0;

    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    const equityCurve = trades.map((trade) => {
      equity += trade.pnl;
      peak = Math.max(peak, equity);
      const drawdown = peak - equity;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      return {
        date: trade.exitTime.toISOString().slice(0, 10),
        equity: Number(equity.toFixed(2)),
        drawdown: Number(drawdown.toFixed(2)),
      };
    });

    const strategyPerformance = [{ name: 'XLS', trades: trades.length, pnl: Number(totalPnl.toFixed(2)) }];
    const tradesByDay = Object.fromEntries(
      calendarDays.map((day) => [
        day.date,
        day.trades.map((trade) => ({
          id: trade.id,
          symbol: trade.symbol,
          pnl: trade.pnl,
          side: trade.side === 'LONG' ? ('BUY' as const) : ('SELL' as const),
          quantity: trade.size,
          openDate: trade.entryTime.toISOString(),
          closeDate: trade.exitTime.toISOString(),
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
      pnlByMonth: [],
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
