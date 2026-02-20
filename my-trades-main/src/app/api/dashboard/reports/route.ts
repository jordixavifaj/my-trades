import { NextRequest, NextResponse } from 'next/server';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { prisma } from '@/lib/prisma';
import { requireRequestUser } from '@/lib/request-auth';

export const runtime = 'nodejs';

const TZ = 'America/New_York';

function parseIsoDateOnly(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function buildUtcRange(from: string | null, to: string | null) {
  // Interpret from/to as trading-day boundaries in TZ, then convert to UTC for DB filtering.
  const start = from ? fromZonedTime(`${from}T00:00:00.000`, TZ) : null;
  const end = to ? fromZonedTime(`${to}T23:59:59.999`, TZ) : null;
  return { start, end };
}

function bucketForMinutes(totalMinutes: number) {
  const bucketSize = 30;
  const bucketStart = Math.floor(totalMinutes / bucketSize) * bucketSize;
  const h1 = Math.floor(bucketStart / 60);
  const m1 = bucketStart % 60;
  const bucketEnd = bucketStart + bucketSize;
  const h2 = Math.floor(bucketEnd / 60);
  const m2 = bucketEnd % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h1)}:${pad(m1)}–${pad(h2)}:${pad(m2)}`;
}

function priceBucket(price: number) {
  if (price < 2) return '0–2';
  if (price < 5) return '2–5';
  if (price < 10) return '5–10';
  if (price < 20) return '10–20';
  return '20+';
}

export async function generateReportsForUser(userId: string, searchParams: URLSearchParams) {
  const from = parseIsoDateOnly(searchParams.get('from'));
  const to = parseIsoDateOnly(searchParams.get('to'));
  const setup = searchParams.get('setup')?.trim() || null;
  const ticker = searchParams.get('ticker')?.trim().toUpperCase() || null;
  const ecnFeePerShareRaw = searchParams.get('ecnFeePerShare');
  const ecnFeePerShare = ecnFeePerShareRaw ? Number(ecnFeePerShareRaw) : 0;

  const { start, end } = buildUtcRange(from, to);

  const trades = await prisma.trade.findMany({
    where: {
      userId,
      status: 'CLOSED',
      fills:
        start || end
          ? {
              some: {
                timestamp: {
                  gte: start ?? undefined,
                  lte: end ?? undefined,
                },
              },
            }
          : undefined,
      symbol: ticker ? ticker : undefined,
      setupName: setup ? setup : undefined,
    },
    orderBy: { closeDate: 'asc' },
    select: {
      id: true,
      symbol: true,
      pnl: true,
      quantity: true,
      side: true,
      openPrice: true,
      closePrice: true,
      openDate: true,
      closeDate: true,
      setupName: true,
      setupSource: true,
      fills: {
        where:
          start || end
            ? {
                timestamp: {
                  gte: start ?? undefined,
                  lte: end ?? undefined,
                },
              }
            : undefined,
        select: { timestamp: true, price: true, quantity: true, side: true, commission: true },
      },
    },
  });

  const normalizedTrades = trades.map((t) => {
    const fillsSorted = t.fills.slice().sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const fillTimes = fillsSorted.map((f) => f.timestamp.getTime());
    const entryTime = fillTimes.length ? new Date(Math.min(...fillTimes)) : t.openDate;
    const exitTime = fillTimes.length ? new Date(Math.max(...fillTimes)) : t.closeDate ?? t.openDate;
    const ecnFees = Math.abs(t.quantity) * (Number.isFinite(ecnFeePerShare) ? ecnFeePerShare : 0);
    const totalCommission = fillsSorted.reduce((s, f) => s + (f.commission ?? 0), 0);
    const pnlGross = t.pnl ?? 0;
    const pnlNet = pnlGross - ecnFees;

    // Compute MAE/MFE from fills
    const isLong = t.side === 'BUY';
    let pos = 0;
    let avgEntry = 0;
    let mae = 0; // worst unrealized (negative = adverse)
    let mfe = 0; // best unrealized (positive = favorable)
    for (const f of fillsSorted) {
      const isSameDir = (isLong && f.side === 'BUY') || (!isLong && f.side === 'SELL');
      if (isSameDir) {
        const newPos = pos + f.quantity;
        avgEntry = newPos === 0 ? 0 : (avgEntry * pos + f.price * f.quantity) / newPos;
        pos = newPos;
      } else {
        pos = Math.max(0, pos - f.quantity);
        if (pos > 0) {
          const unrealized = isLong ? (f.price - avgEntry) * pos : (avgEntry - f.price) * pos;
          mae = Math.min(mae, unrealized);
          mfe = Math.max(mfe, unrealized);
        }
      }
    }

    return {
      id: t.id,
      symbol: t.symbol,
      pnlGross,
      pnlNet,
      ecnFees,
      commission: totalCommission,
      size: t.quantity,
      entryTime,
      exitTime,
      entryPrice: t.openPrice,
      setupName: t.setupName ?? null,
      side: t.side,
      mae,
      mfe,
    };
  });

  const totalPnlGross = normalizedTrades.reduce((sum, t) => sum + t.pnlGross, 0);
  const totalEcnFees = normalizedTrades.reduce((sum, t) => sum + t.ecnFees, 0);
  const totalPnlNet = normalizedTrades.reduce((sum, t) => sum + t.pnlNet, 0);

  // ---- Performance by setup ----
  type SetupAgg = {
    setupName: string;
    trades: number;
    wins: number;
    losses: number;
    pnlTotal: number;
    avgWin: number;
    avgLoss: number;
    winRate: number;
    lossRate: number;
    winLossRatio: number | null;
    expectancy: number;
    contributionPct: number;
  };

  const setupMap = new Map<string, { pnls: number[]; pnlTotal: number; ecnFeesTotal: number; wins: number; losses: number }>();
  for (const t of normalizedTrades) {
    const key = t.setupName ?? 'UNLABELED';
    const curr = setupMap.get(key) ?? { pnls: [], pnlTotal: 0, ecnFeesTotal: 0, wins: 0, losses: 0 };
    curr.pnls.push(t.pnlNet);
    curr.pnlTotal += t.pnlNet;
    curr.ecnFeesTotal += t.ecnFees;
    if (t.pnlNet > 0) curr.wins += 1;
    else if (t.pnlNet < 0) curr.losses += 1;
    setupMap.set(key, curr);
  }

  const setupPerformance: SetupAgg[] = Array.from(setupMap.entries()).map(([setupName, s]) => {
    const tradesCount = s.pnls.length;
    const wins = s.wins;
    const losses = s.losses;
    const winRate = tradesCount ? wins / tradesCount : 0;
    const lossRate = tradesCount ? losses / tradesCount : 0;

    const winPnls = s.pnls.filter((p) => p > 0);
    const lossPnlsAbs = s.pnls.filter((p) => p < 0).map((p) => Math.abs(p));

    const avgWin = winPnls.length ? winPnls.reduce((a, b) => a + b, 0) / winPnls.length : 0;
    const avgLoss = lossPnlsAbs.length ? lossPnlsAbs.reduce((a, b) => a + b, 0) / lossPnlsAbs.length : 0;

    const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : null;
    const expectancy = winRate * avgWin - lossRate * avgLoss;
    const contributionPct = totalPnlNet !== 0 ? (s.pnlTotal / totalPnlNet) * 100 : 0;

    return {
      setupName,
      trades: tradesCount,
      wins,
      losses,
      pnlTotal: Number(s.pnlTotal.toFixed(2)),
      avgWin: Number(avgWin.toFixed(2)),
      avgLoss: Number(avgLoss.toFixed(2)),
      winRate: Number((winRate * 100).toFixed(2)),
      lossRate: Number((lossRate * 100).toFixed(2)),
      winLossRatio: winLossRatio === null ? null : Number(winLossRatio.toFixed(2)),
      expectancy: Number(expectancy.toFixed(2)),
      contributionPct: Number(contributionPct.toFixed(2)),
    };
  });

  setupPerformance.sort((a, b) => b.pnlTotal - a.pnlTotal);

  // ---- Temporal stats (by half-hour bucket) ----
  const bucketMap = new Map<string, { pnl: number; trades: number }>();
  for (const t of normalizedTrades) {
    const z = toZonedTime(t.entryTime, TZ);
    const minutes = z.getHours() * 60 + z.getMinutes();
    const bucket = bucketForMinutes(minutes);
    const curr = bucketMap.get(bucket) ?? { pnl: 0, trades: 0 };
    curr.pnl += t.pnlNet;
    curr.trades += 1;
    bucketMap.set(bucket, curr);
  }

  const pnlByTimeBucket = Array.from(bucketMap.entries())
    .map(([bucket, v]) => ({ bucket, pnl: Number(v.pnl.toFixed(2)), trades: v.trades }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));

  const bestTimeBucket = pnlByTimeBucket.reduce(
    (best, curr) => (!best || curr.pnl > best.pnl ? curr : best),
    null as null | { bucket: string; pnl: number; trades: number },
  );
  const worstTimeBucket = pnlByTimeBucket.reduce(
    (worst, curr) => (!worst || curr.pnl < worst.pnl ? curr : worst),
    null as null | { bucket: string; pnl: number; trades: number },
  );

  // ---- Price buckets (by entry price) ----
  const priceMap = new Map<string, { pnl: number; trades: number }>();
  for (const t of normalizedTrades) {
    const b = priceBucket(t.entryPrice);
    const curr = priceMap.get(b) ?? { pnl: 0, trades: 0 };
    curr.pnl += t.pnlNet;
    curr.trades += 1;
    priceMap.set(b, curr);
  }

  const pnlByPriceBucket = ['0–2', '2–5', '5–10', '10–20', '20+']
    .map((bucket) => {
      const v = priceMap.get(bucket) ?? { pnl: 0, trades: 0 };
      return { bucket, pnl: Number(v.pnl.toFixed(2)), trades: v.trades };
    })
    .filter((row) => row.trades > 0);

  const bestPriceBucket = pnlByPriceBucket.reduce(
    (best, curr) => (!best || curr.pnl > best.pnl ? curr : best),
    null as null | { bucket: string; pnl: number; trades: number },
  );
  const worstPriceBucket = pnlByPriceBucket.reduce(
    (worst, curr) => (!worst || curr.pnl < worst.pnl ? curr : worst),
    null as null | { bucket: string; pnl: number; trades: number },
  );

  // ---- Tradervue-style statistics ----
  const n = normalizedTrades.length;
  const pnls = normalizedTrades.map((t) => t.pnlNet);
  const winners = normalizedTrades.filter((t) => t.pnlNet > 0);
  const losers = normalizedTrades.filter((t) => t.pnlNet < 0);
  const scratchThreshold = 0.5; // trades with |pnl| <= threshold are scratch
  const scratches = normalizedTrades.filter((t) => Math.abs(t.pnlNet) <= scratchThreshold);

  const largestGain = n ? Math.max(...pnls) : 0;
  const largestLoss = n ? Math.min(...pnls) : 0;

  const totalWinPnl = winners.reduce((s, t) => s + t.pnlNet, 0);
  const totalLossPnl = losers.reduce((s, t) => s + t.pnlNet, 0);

  const avgTradeGainLoss = n ? totalPnlNet / n : 0;
  const avgWinningTrade = winners.length ? totalWinPnl / winners.length : 0;
  const avgLosingTrade = losers.length ? totalLossPnl / losers.length : 0;

  // Per-share
  const totalShares = normalizedTrades.reduce((s, t) => s + Math.abs(t.size), 0);
  const avgPerShareGainLoss = totalShares ? totalPnlNet / totalShares : 0;

  // Daily aggregation
  const dayMap = new Map<string, { pnl: number; trades: number }>();
  for (const t of normalizedTrades) {
    const day = toZonedTime(t.entryTime, TZ).toISOString().slice(0, 10);
    const d = dayMap.get(day) ?? { pnl: 0, trades: 0 };
    d.pnl += t.pnlNet;
    d.trades += 1;
    dayMap.set(day, d);
  }
  const tradingDays = dayMap.size || 1;
  const avgDailyGainLoss = totalPnlNet / tradingDays;
  const avgDailyVolume = n / tradingDays;

  // Hold times
  const holdMs = (t: typeof normalizedTrades[0]) => t.exitTime.getTime() - t.entryTime.getTime();
  const avgHoldWinning = winners.length ? winners.reduce((s, t) => s + holdMs(t), 0) / winners.length : 0;
  const avgHoldLosing = losers.length ? losers.reduce((s, t) => s + holdMs(t), 0) / losers.length : 0;
  const avgHoldScratch = scratches.length ? scratches.reduce((s, t) => s + holdMs(t), 0) / scratches.length : 0;
  const msToMinutes = (ms: number) => Number((ms / 60000).toFixed(1));

  // Consecutive wins/losses
  let maxConsecWins = 0;
  let maxConsecLosses = 0;
  let curWins = 0;
  let curLosses = 0;
  for (const p of pnls) {
    if (p > 0) { curWins++; curLosses = 0; maxConsecWins = Math.max(maxConsecWins, curWins); }
    else if (p < 0) { curLosses++; curWins = 0; maxConsecLosses = Math.max(maxConsecLosses, curLosses); }
    else { curWins = 0; curLosses = 0; }
  }

  // Standard deviation
  const mean = avgTradeGainLoss;
  const variance = n > 1 ? pnls.reduce((s, p) => s + (p - mean) ** 2, 0) / (n - 1) : 0;
  const stdDev = Math.sqrt(variance);

  // SQN = sqrt(N) * mean / stdDev
  const sqn = stdDev > 0 && n > 0 ? (Math.sqrt(n) * mean) / stdDev : 0;

  // Probability of Random Chance (one-sample t-test p-value approximation)
  const tStat = stdDev > 0 && n > 1 ? (mean / (stdDev / Math.sqrt(n))) : 0;
  // Approximate two-tailed p-value using normal CDF for large n
  const probRandomChance = n > 1 && stdDev > 0
    ? Math.min(1, 2 * (1 - 0.5 * (1 + Math.min(1, Math.max(-1,
        (1 - Math.exp(-0.7988 * Math.abs(tStat) * (1 + 0.04417 * tStat * tStat))))))))
    : 1;

  // Win rate, Kelly, Profit Factor
  const winRate = n ? winners.length / n : 0;
  const lossRate = n ? losers.length / n : 0;
  const winLossRatio = avgLosingTrade !== 0 ? Math.abs(avgWinningTrade / avgLosingTrade) : 0;
  const kellyPct = winLossRatio > 0 ? winRate - (lossRate / winLossRatio) : 0;
  const profitFactor = totalLossPnl !== 0 ? Math.abs(totalWinPnl / totalLossPnl) : totalWinPnl > 0 ? Infinity : 0;

  // K-Ratio (slope of cumulative PnL regression line / std error of slope)
  let kRatio = 0;
  if (n > 2) {
    const cumPnl: number[] = [];
    let cum = 0;
    for (const p of pnls) { cum += p; cumPnl.push(cum); }
    const xMean = (n - 1) / 2;
    const yMean = cumPnl.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sxy += (i - xMean) * (cumPnl[i] - yMean); sxx += (i - xMean) ** 2; }
    const slope = sxx > 0 ? sxy / sxx : 0;
    let sse = 0;
    for (let i = 0; i < n; i++) { const yHat = yMean + slope * (i - xMean); sse += (cumPnl[i] - yHat) ** 2; }
    const mse = sse / (n - 2);
    const slopeStdErr = sxx > 0 ? Math.sqrt(mse / sxx) : 0;
    kRatio = slopeStdErr > 0 ? slope / slopeStdErr : 0;
  }

  // Commissions & Fees
  const totalCommissions = normalizedTrades.reduce((s, t) => s + t.commission, 0);
  const totalFees = totalEcnFees + totalCommissions;

  // MAE / MFE averages
  const avgMAE = n ? normalizedTrades.reduce((s, t) => s + t.mae, 0) / n : 0;
  const avgMFE = n ? normalizedTrades.reduce((s, t) => s + t.mfe, 0) / n : 0;

  const r = (v: number, d = 2) => Number(v.toFixed(d));

  const stats = {
    totalGainLoss: r(totalPnlNet),
    largestGain: r(largestGain),
    largestLoss: r(largestLoss),
    avgDailyGainLoss: r(avgDailyGainLoss),
    avgDailyVolume: r(avgDailyVolume, 1),
    avgPerShareGainLoss: r(avgPerShareGainLoss, 4),
    avgTradeGainLoss: r(avgTradeGainLoss),
    avgWinningTrade: r(avgWinningTrade),
    avgLosingTrade: r(avgLosingTrade),
    totalTrades: n,
    winningTrades: winners.length,
    winningTradesPct: r(winRate * 100, 1),
    losingTrades: losers.length,
    losingTradesPct: r(lossRate * 100, 1),
    scratchTrades: scratches.length,
    scratchTradesPct: r(n ? (scratches.length / n) * 100 : 0, 1),
    avgHoldWinningMin: msToMinutes(avgHoldWinning),
    avgHoldLosingMin: msToMinutes(avgHoldLosing),
    avgHoldScratchMin: msToMinutes(avgHoldScratch),
    maxConsecWins,
    maxConsecLosses,
    stdDev: r(stdDev),
    sqn: r(sqn),
    probRandomChance: r(probRandomChance, 4),
    kellyPct: r(kellyPct * 100, 2),
    kRatio: r(kRatio),
    profitFactor: profitFactor === Infinity ? 'Inf' : r(profitFactor),
    totalCommissions: r(totalCommissions),
    totalFees: r(totalFees),
    avgMAE: r(avgMAE),
    avgMFE: r(avgMFE),
    tradingDays,
  };

  return {
    filters: { from, to, setup, ticker, tz: TZ, ecnFeePerShare: Number.isFinite(ecnFeePerShare) ? ecnFeePerShare : 0 },
    totals: {
      trades: normalizedTrades.length,
      pnlGrossTotal: Number(totalPnlGross.toFixed(2)),
      ecnFeesTotal: Number(totalEcnFees.toFixed(2)),
      pnlNetTotal: Number(totalPnlNet.toFixed(2)),
    },
    stats,
    setupPerformance,
    temporal: {
      pnlByTimeBucket,
      bestTimeBucket,
      worstTimeBucket,
    },
    price: {
      pnlByPriceBucket,
      bestPriceBucket,
      worstPriceBucket,
    },
  };
}

export async function GET(request: NextRequest) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const data = await generateReportsForUser(auth.id, searchParams);
  return NextResponse.json(data);
}
