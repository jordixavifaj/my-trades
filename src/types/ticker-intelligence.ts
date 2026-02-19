export type TradeSide = 'Long' | 'Short';
export type SetupPhase = 'Frontside' | 'Transition' | 'Backside';

export type SetupTier = 'A' | 'B' | 'C';

export interface TickerSnapshot {
  ticker: string;
  gapPercent: number;
  premarketVolumeRatio: number;
  floatMillions: number;
  relativeVolume: number;
  floatRotation: number;
  spreadPercent: number;
  marketConditionScore: number;
  dilutionRiskScore: number;
  catalystScore: number;
  volatilityQualityScore: number;
  multiDayRunPercent: number;
  vwapHoldPercentSession: number;
  breakoutMinutesFromOpen: number;
  intradayExtensionPercent: number;
  shortInterestPercent: number;
  sympathyStrengthIndex: number;
  hasActiveATM: boolean;
  hasFrequentHalts: boolean;
  hasContradictoryNews: boolean;
  hasErraticVolume: boolean;
  hasManipulationSignals: boolean;
}

export interface SetupDefinition {
  id: string;
  name: string;
  side: TradeSide;
  phase: SetupPhase;
  summary: string;
  score: (snapshot: TickerSnapshot) => number;
}

export interface IntelligenceResult {
  ticker: string;
  phase: SetupPhase;
  primarySetup: SetupDefinition;
  confidence: number;
  historicalExpectancyR: number;
  winrate: number;
  averageRR: number;
  dilutionRiskLabel: 'Low' | 'Medium' | 'High';
  liquidityQuality: string;
  riskTier: SetupTier;
  suggestedSizeMultiplier: number;
  blockers: string[];
  edgeWeakening: boolean;
  qualityChecks: Array<{ label: string; passed: boolean }>;
  scoreBreakdown: Record<string, number>;
  expectancy3m: number;
  expectancy6m: number;
  expectancyTotal: number;
}
