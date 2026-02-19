import { SetupDefinition, TickerSnapshot } from '@/types/ticker-intelligence';

const clamp = (value: number) => Math.max(0, Math.min(100, value));

const momentumScore = (snapshot: TickerSnapshot) =>
  clamp(
    snapshot.gapPercent * 1.4 +
      snapshot.premarketVolumeRatio * 16 +
      snapshot.relativeVolume * 10 +
      snapshot.catalystScore * 0.35 -
      snapshot.dilutionRiskScore * 0.45 -
      snapshot.spreadPercent * 25,
  );

const exhaustionScore = (snapshot: TickerSnapshot) =>
  clamp(
    snapshot.intradayExtensionPercent * 1.1 +
      snapshot.multiDayRunPercent * 0.4 +
      snapshot.shortInterestPercent * 0.9 +
      snapshot.dilutionRiskScore * 0.2,
  );

const backsideScore = (snapshot: TickerSnapshot) =>
  clamp(
    snapshot.multiDayRunPercent * 0.6 +
      (100 - snapshot.vwapHoldPercentSession) * 0.55 +
      snapshot.relativeVolume * 13 +
      snapshot.dilutionRiskScore * 0.25,
  );

export const setupCatalog: SetupDefinition[] = [
  {
    id: 'GAP_GO',
    name: 'Gap & Go',
    side: 'Long',
    phase: 'Frontside',
    summary: 'Gap fuerte, catalizador activo y ruptura temprana con volumen.',
    score: (snapshot) =>
      clamp(
        momentumScore(snapshot) +
          (snapshot.breakoutMinutesFromOpen <= 45 ? 14 : -10) +
          (snapshot.floatMillions < 20 ? 9 : 0) +
          (snapshot.hasActiveATM ? -30 : 5),
      ),
  },
  {
    id: 'BREAKOUT',
    name: 'Breakout',
    side: 'Long',
    phase: 'Frontside',
    summary: 'Ruptura de nivel clave con confirmación de volumen y liquidez.',
    score: (snapshot) => clamp(momentumScore(snapshot) + snapshot.floatRotation * 8),
  },
  {
    id: 'VWAP_RECLAIM',
    name: 'VWAP Reclaim',
    side: 'Long',
    phase: 'Frontside',
    summary: 'Recuperación de VWAP como señal de cambio de control comprador.',
    score: (snapshot) =>
      clamp(60 + snapshot.floatRotation * 12 + snapshot.catalystScore * 0.25 - snapshot.spreadPercent * 30),
  },
  {
    id: 'GREEN_TO_RED',
    name: 'Green to Red',
    side: 'Short',
    phase: 'Transition',
    summary: 'Pérdida del open tras apertura verde, confirmando control vendedor.',
    score: (snapshot) => clamp(backsideScore(snapshot) + exhaustionScore(snapshot) * 0.35),
  },
  {
    id: 'FIRST_DAY_RED',
    name: 'First Day Red',
    side: 'Short',
    phase: 'Backside',
    summary: 'Fin del multi-day run y transición confirmada a distribución.',
    score: (snapshot) => clamp(backsideScore(snapshot) + (snapshot.multiDayRunPercent > 80 ? 15 : 0)),
  },
  {
    id: 'BULL_TRAP',
    name: 'Bull Trap',
    side: 'Short',
    phase: 'Frontside',
    summary: 'Falso breakout con fallo rápido y presión de atrapados.',
    score: (snapshot) => clamp(exhaustionScore(snapshot) + snapshot.relativeVolume * 12),
  },
  {
    id: 'GAP_CRAP',
    name: 'Gap & Crap',
    side: 'Short',
    phase: 'Backside',
    summary: 'Gap alcista fallido con pérdida de niveles clave.',
    score: (snapshot) => clamp(backsideScore(snapshot) + snapshot.dilutionRiskScore * 0.3),
  },
];
