import { setupCatalog } from '@/lib/ticker-intelligence/setups';
import { IntelligenceResult, SetupDefinition, SetupPhase, SetupTier, TickerSnapshot } from '@/types/ticker-intelligence';

const historyMap: Record<string, { expectancy: number; winrate: number; rr: number }> = {
  GAP_GO: { expectancy: 0.43, winrate: 39, rr: 2.4 },
  BREAKOUT: { expectancy: 0.35, winrate: 42, rr: 2.1 },
  VWAP_RECLAIM: { expectancy: 0.29, winrate: 46, rr: 1.8 },
  GREEN_TO_RED: { expectancy: 0.38, winrate: 41, rr: 2.2 },
  FIRST_DAY_RED: { expectancy: 0.47, winrate: 44, rr: 2.5 },
  BULL_TRAP: { expectancy: 0.33, winrate: 37, rr: 2.6 },
  GAP_CRAP: { expectancy: 0.4, winrate: 40, rr: 2.4 },
};

const phaseFromSnapshot = (s: TickerSnapshot): SetupPhase => {
  if (s.multiDayRunPercent > 80 && s.vwapHoldPercentSession < 30) return 'Backside';
  if (s.vwapHoldPercentSession < 50 || s.intradayExtensionPercent > 35) return 'Transition';
  return 'Frontside';
};

const universalBlockers = (s: TickerSnapshot) => {
  const reasons: string[] = [];
  if (s.hasFrequentHalts) reasons.push('Halts frecuentes');
  if (s.hasContradictoryNews) reasons.push('Noticias contradictorias');
  if (s.hasErraticVolume) reasons.push('Volumen errático no orgánico');
  if (s.hasManipulationSignals) reasons.push('Manipulación evidente');
  if (s.spreadPercent > 1.5) reasons.push('Spread anormal');
  return reasons;
};

const longBlockers = (s: TickerSnapshot, phase: SetupPhase) => {
  const reasons: string[] = [];
  if (s.hasActiveATM || s.dilutionRiskScore > 75) reasons.push('Dilución activa o probable');
  if (phase === 'Backside') reasons.push('Backside confirmada');
  if (s.relativeVolume < 1.5 || s.floatRotation < 0.8) reasons.push('Falta de volumen relativo');
  if (s.spreadPercent > 1) reasons.push('Spread/Liquidez deficiente');
  if (s.marketConditionScore < 40) reasons.push('Condiciones de mercado desfavorables');
  if (s.intradayExtensionPercent > 40 || s.breakoutMinutesFromOpen > 30) reasons.push('Overextension tardía');
  return reasons;
};

const shortBlockers = (s: TickerSnapshot, phase: SetupPhase) => {
  const reasons: string[] = [];
  if (phase === 'Frontside' && s.vwapHoldPercentSession > 70 && s.floatRotation > 1.1) reasons.push('Frontside momentum activo');
  if (s.catalystScore > 85 && s.sympathyStrengthIndex > 65) reasons.push('Catalizador fuerte + institucional');
  if (s.shortInterestPercent > 20 && s.floatMillions < 10) reasons.push('Short squeeze risk alto');
  if (s.relativeVolume < 1.3) reasons.push('Volumen insuficiente en breakdown');
  if (s.intradayExtensionPercent < -35 || s.spreadPercent > 1.2) reasons.push('Exhaustion shorting');
  return reasons;
};

const riskTier = (confidence: number, blockers: number): SetupTier => {
  if (blockers > 0 || confidence < 55) return 'C';
  if (confidence < 75) return 'B';
  return 'A';
};

const liquidityQuality = (spreadPercent: number, relativeVolume: number) => {
  if (spreadPercent < 0.25 && relativeVolume > 2) return 'A';
  if (spreadPercent < 0.5 && relativeVolume > 1.6) return 'A-';
  if (spreadPercent < 0.8) return 'B';
  return 'C';
};

export const analyzeTicker = (snapshot: TickerSnapshot): IntelligenceResult => {
  const phase = phaseFromSnapshot(snapshot);
  const setupScores = setupCatalog.map((setup) => ({ setup, score: setup.score(snapshot) }));
  const primary = setupScores.sort((a, b) => b.score - a.score)[0];

  const universal = universalBlockers(snapshot);
  const directional =
    primary.setup.side === 'Long' ? longBlockers(snapshot, phase) : shortBlockers(snapshot, phase);
  const blockers = [...universal, ...directional];

  const qualityChecks = [
    { label: 'Fase coherente con setup', passed: primary.setup.phase === phase || phase === 'Transition' },
    { label: 'Volumen confirma movimiento', passed: snapshot.relativeVolume >= 1.5 },
    { label: 'Liquidez ejecutable', passed: snapshot.spreadPercent <= 1 },
    { label: 'Dilución bajo control', passed: snapshot.dilutionRiskScore <= 70 && !snapshot.hasActiveATM },
    { label: 'Mercado general acompaña', passed: snapshot.marketConditionScore >= 45 },
  ];

  const history = historyMap[primary.setup.id] ?? { expectancy: 0.2, winrate: 35, rr: 1.8 };
  const confidence = Math.max(5, Math.min(99, primary.score - blockers.length * 12));
  const tier = riskTier(confidence, blockers.length);

  const expectancy3m = Number((history.expectancy - (snapshot.marketConditionScore < 40 ? 0.11 : 0.01)).toFixed(2));
  const expectancy6m = Number((history.expectancy - 0.04).toFixed(2));
  const expectancyTotal = history.expectancy;

  return {
    ticker: snapshot.ticker.toUpperCase(),
    phase,
    primarySetup: primary.setup,
    confidence,
    historicalExpectancyR: history.expectancy,
    winrate: history.winrate,
    averageRR: history.rr,
    dilutionRiskLabel: snapshot.dilutionRiskScore < 35 ? 'Low' : snapshot.dilutionRiskScore < 70 ? 'Medium' : 'High',
    liquidityQuality: liquidityQuality(snapshot.spreadPercent, snapshot.relativeVolume),
    riskTier: tier,
    suggestedSizeMultiplier: tier === 'A' ? 1 : tier === 'B' ? 0.8 : 0.5,
    blockers: blockers.length ? blockers : ['Ninguno'],
    edgeWeakening: expectancy3m < expectancy6m && expectancy6m < expectancyTotal,
    qualityChecks,
    scoreBreakdown: {
      catalyst: snapshot.catalystScore,
      structure: Math.round(primary.score),
      liquidity: Math.round((snapshot.relativeVolume * 35 - snapshot.spreadPercent * 18) * 1.2),
      dilutionRisk: snapshot.dilutionRiskScore,
      volatilityQuality: snapshot.volatilityQualityScore,
    },
    expectancy3m,
    expectancy6m,
    expectancyTotal,
  };
};

export const defaultSnapshot: TickerSnapshot = {
  ticker: 'XYZ',
  gapPercent: 18,
  premarketVolumeRatio: 2.4,
  floatMillions: 14,
  relativeVolume: 2.1,
  floatRotation: 1.6,
  spreadPercent: 0.38,
  marketConditionScore: 62,
  dilutionRiskScore: 28,
  catalystScore: 81,
  volatilityQualityScore: 74,
  multiDayRunPercent: 42,
  vwapHoldPercentSession: 58,
  breakoutMinutesFromOpen: 22,
  intradayExtensionPercent: 26,
  shortInterestPercent: 14,
  sympathyStrengthIndex: 68,
  hasActiveATM: false,
  hasFrequentHalts: false,
  hasContradictoryNews: false,
  hasErraticVolume: false,
  hasManipulationSignals: false,
};
