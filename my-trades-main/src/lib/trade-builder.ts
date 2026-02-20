import { Execution } from '@/lib/executions-parser';
import { formatInTimeZone } from 'date-fns-tz';

export interface Trade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  pnl: number;
  executions: Execution[];
}

export interface CalendarDay {
  date: string;
  totalTrades: number;
  totalPnl: number;
  trades: Trade[];
}

export function buildTradesFromExecutions(executions: Execution[]): Trade[] {
  const grouped = new Map<string, Execution[]>();

  for (const execution of executions) {
    const nyDay = formatInTimeZone(execution.timestamp, 'America/New_York', 'yyyy-MM-dd');
    const key = `${execution.account}::${execution.symbol}::${nyDay}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(execution);
  }

  const trades: Trade[] = [];

  for (const [key, symbolExecutions] of Array.from(grouped.entries())) {
    symbolExecutions.sort((a: Execution, b: Execution) => a.timestamp.getTime() - b.timestamp.getTime());

    let positionSize = 0;
    let avgEntryPrice = 0;
    let entryTime: Date | null = null;
    let side: 'LONG' | 'SHORT' | null = null;
    let openExecutions: Execution[] = [];
    let runningCommission = 0;
    let realizedGross = 0;
    let totalEntryQty = 0;
    let entryNotional = 0;
    let totalExitQty = 0;
    let exitNotional = 0;
    let tradeSequence = 1;

    const flushClose = (closingExecution: Execution) => {
      if (!side || !entryTime) return;
      const pnl = realizedGross - runningCommission;
      const entryPrice = totalEntryQty > 0 ? entryNotional / totalEntryQty : avgEntryPrice;
      const exitPrice = totalExitQty > 0 ? exitNotional / totalExitQty : closingExecution.price;
      trades.push({
        id: `${key}-${tradeSequence}`,
        symbol: closingExecution.symbol,
        side,
        size: totalExitQty > 0 ? totalExitQty : Math.abs(positionSize),
        entryPrice,
        exitPrice,
        entryTime,
        exitTime: closingExecution.timestamp,
        pnl,
        executions: openExecutions.slice(),
      });
      tradeSequence += 1;
    };

    for (const execution of symbolExecutions) {
      const execSide = execution.side;

      let remainingQty = execution.quantity;
      const signedQty = execSide === 'BUY' ? execution.quantity : -execution.quantity;
      const executionSign = Math.sign(signedQty);

      if (positionSize === 0) {
        positionSize = signedQty;
        avgEntryPrice = execution.price;
        entryTime = execution.timestamp;
        side = positionSize > 0 ? 'LONG' : 'SHORT';
        openExecutions = [execution];
        runningCommission = execution.commission;
        realizedGross = 0;
        totalEntryQty = execution.quantity;
        entryNotional = execution.price * execution.quantity;
        totalExitQty = 0;
        exitNotional = 0;
        continue;
      }

      const sameDirection = Math.sign(positionSize) === executionSign;
      if (sameDirection) {
        const newAbs = Math.abs(positionSize) + remainingQty;
        avgEntryPrice = (avgEntryPrice * Math.abs(positionSize) + execution.price * remainingQty) / newAbs;
        positionSize += signedQty;
        openExecutions.push(execution);
        runningCommission += execution.commission;
        totalEntryQty += remainingQty;
        entryNotional += execution.price * remainingQty;
        continue;
      }

      const closeQty = Math.min(Math.abs(positionSize), remainingQty);
      const commissionPerUnit = execution.commission / execution.quantity;
      const closeCommission = commissionPerUnit * closeQty;
      const gross = side === 'LONG' ? (execution.price - avgEntryPrice) * closeQty : (avgEntryPrice - execution.price) * closeQty;
      realizedGross += gross;
      runningCommission += closeCommission;
      totalExitQty += closeQty;
      exitNotional += execution.price * closeQty;
      openExecutions.push({ ...execution, quantity: closeQty, commission: closeCommission });

      const afterClose = Math.abs(positionSize) - closeQty;
      const leftoverQty = remainingQty - closeQty;

      if (afterClose > 0) {
        positionSize = Math.sign(positionSize) * afterClose;
      } else {
        positionSize = 0;
        flushClose(execution);
        positionSize = 0;
        avgEntryPrice = 0;
        entryTime = null;
        side = null;
        openExecutions = [];
        runningCommission = 0;
        realizedGross = 0;
        totalEntryQty = 0;
        entryNotional = 0;
        totalExitQty = 0;
        exitNotional = 0;
      }

      if (leftoverQty > 0) {
        const openCommission = commissionPerUnit * leftoverQty;
        positionSize = execSide === 'BUY' ? leftoverQty : -leftoverQty;
        avgEntryPrice = execution.price;
        entryTime = execution.timestamp;
        side = positionSize > 0 ? 'LONG' : 'SHORT';
        openExecutions = [{ ...execution, quantity: leftoverQty, commission: openCommission }];
        runningCommission = openCommission;
        realizedGross = 0;
        totalEntryQty = leftoverQty;
        entryNotional = execution.price * leftoverQty;
        totalExitQty = 0;
        exitNotional = 0;
      }
    }
  }

  return trades.sort((a, b) => a.exitTime.getTime() - b.exitTime.getTime());
}

export function groupTradesByDay(trades: Trade[]): CalendarDay[] {
  const grouped = new Map<string, CalendarDay>();

  for (const trade of trades) {
    const date = trade.exitTime.toISOString().slice(0, 10);
    if (!grouped.has(date)) grouped.set(date, { date, totalTrades: 0, totalPnl: 0, trades: [] });
    const day = grouped.get(date)!;
    day.totalTrades += 1;
    day.totalPnl += trade.pnl;
    day.trades.push(trade);
  }

  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
}
