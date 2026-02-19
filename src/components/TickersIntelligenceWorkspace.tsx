'use client';

import { analyzeTicker, defaultSnapshot } from '@/lib/ticker-intelligence/engine';
import { setupCatalog } from '@/lib/ticker-intelligence/setups';
import { TickerSnapshot } from '@/types/ticker-intelligence';
import { useMemo, useState } from 'react';

const numberFields: Array<{ key: keyof TickerSnapshot; label: string; min?: number; max?: number; step?: number }> = [
  { key: 'gapPercent', label: 'Gap %', step: 0.1 },
  { key: 'premarketVolumeRatio', label: 'Premarket Vol Ratio', step: 0.1 },
  { key: 'floatMillions', label: 'Float (M)', step: 0.1 },
  { key: 'relativeVolume', label: 'Relative Volume', step: 0.1 },
  { key: 'floatRotation', label: 'Float Rotation', step: 0.1 },
  { key: 'spreadPercent', label: 'Spread %', step: 0.01 },
  { key: 'marketConditionScore', label: 'Market Condition Score', min: 0, max: 100 },
  { key: 'dilutionRiskScore', label: 'Dilution Risk Score', min: 0, max: 100 },
  { key: 'catalystScore', label: 'Catalyst Score', min: 0, max: 100 },
  { key: 'volatilityQualityScore', label: 'Volatility Quality Score', min: 0, max: 100 },
  { key: 'multiDayRunPercent', label: 'Multi-day run %', step: 0.1 },
  { key: 'vwapHoldPercentSession', label: 'VWAP Hold % session', min: 0, max: 100 },
  { key: 'breakoutMinutesFromOpen', label: 'Breakout minutes from open', step: 1 },
  { key: 'intradayExtensionPercent', label: 'Intraday extension %', step: 0.1 },
  { key: 'shortInterestPercent', label: 'Short interest %', step: 0.1 },
  { key: 'sympathyStrengthIndex', label: 'SSI', min: 0, max: 100 },
];

const boolFields: Array<{ key: keyof TickerSnapshot; label: string }> = [
  { key: 'hasActiveATM', label: 'ATM activo' },
  { key: 'hasFrequentHalts', label: 'Halts frecuentes' },
  { key: 'hasContradictoryNews', label: 'Noticias contradictorias' },
  { key: 'hasErraticVolume', label: 'Volumen errático' },
  { key: 'hasManipulationSignals', label: 'Manipulación evidente' },
];

export function TickersIntelligenceWorkspace() {
  const [snapshot, setSnapshot] = useState<TickerSnapshot>(defaultSnapshot);
  const result = useMemo(() => analyzeTicker(snapshot), [snapshot]);

  return (
    <section className="space-y-6">
      <div className="panel p-6">
        <h1 className="panel-title">Tickers Intelligence</h1>
        <p className="mt-2 text-sm text-slate-300">
          Convierte tu playbook discrecional en un motor cuantitativo: clasifica fase, setup dominante, bloqueadores estructurales y sizing dinámico.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-300">
              Ticker
              <input
                value={snapshot.ticker}
                onChange={(e) => setSnapshot((prev) => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
            {numberFields.map((field) => (
              <label key={String(field.key)} className="text-sm text-slate-300">
                {field.label}
                <input
                  type="number"
                  step={field.step ?? 1}
                  min={field.min}
                  max={field.max}
                  value={snapshot[field.key] as number}
                  onChange={(e) =>
                    setSnapshot((prev) => ({
                      ...prev,
                      [field.key]: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {boolFields.map((field) => (
              <label key={String(field.key)} className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={snapshot[field.key] as boolean}
                  onChange={(e) =>
                    setSnapshot((prev) => ({
                      ...prev,
                      [field.key]: e.target.checked,
                    }))
                  }
                />
                {field.label}
              </label>
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <p className="text-xs uppercase tracking-wide text-cyan-300">Output</p>
          <h2 className="mt-2 text-2xl font-semibold">{result.ticker}</h2>
          <ul className="mt-4 space-y-1 text-sm text-slate-300">
            <li>Phase: {result.phase}</li>
            <li>Primary Setup: {result.primarySetup.name}</li>
            <li>Confidence: {result.confidence}%</li>
            <li>Historical Expectancy: {result.historicalExpectancyR.toFixed(2)}R</li>
            <li>Winrate: {result.winrate}%</li>
            <li>Average RR: {result.averageRR}</li>
            <li>Dilution Risk: {result.dilutionRiskLabel}</li>
            <li>Float Rotation: {snapshot.floatRotation.toFixed(2)}x</li>
            <li>Liquidity Quality: {result.liquidityQuality}</li>
            <li>Risk Tier: {result.riskTier}</li>
            <li>Suggested Size Multiplier: {result.suggestedSizeMultiplier}x</li>
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-6">
          <h3 className="panel-title">Blockers & Quality Filter</h3>
          <p className="mt-3 text-sm text-slate-400">Trade Status: {result.blockers[0] === 'Ninguno' ? 'ACTIVE' : 'BLOCKED'}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
            {result.blockers.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 text-sm">
            {result.qualityChecks.map((check) => (
              <p key={check.label} className={check.passed ? 'text-emerald-300' : 'text-amber-300'}>
                {check.passed ? '✓' : '✗'} {check.label}
              </p>
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <h3 className="panel-title">Composite Edge & Decay</h3>
          <ul className="mt-3 space-y-1 text-sm text-slate-300">
            <li>Catalyst Score: {result.scoreBreakdown.catalyst}</li>
            <li>Structure Score: {result.scoreBreakdown.structure}</li>
            <li>Liquidity Score: {result.scoreBreakdown.liquidity}</li>
            <li>Dilution Risk Score: {result.scoreBreakdown.dilutionRisk}</li>
            <li>Volatility Quality Score: {result.scoreBreakdown.volatilityQuality}</li>
            <li>Expectancy 3M: {result.expectancy3m}R</li>
            <li>Expectancy 6M: {result.expectancy6m}R</li>
            <li>Expectancy Histórico: {result.expectancyTotal}R</li>
          </ul>
          <p className={`mt-4 text-sm font-medium ${result.edgeWeakening ? 'text-amber-300' : 'text-emerald-300'}`}>
            {result.edgeWeakening ? 'Edge Weakening detectado' : 'Edge estable'}
          </p>
        </div>
      </div>

      <div className="panel p-6">
        <h3 className="panel-title">Explicación concisa de setups</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {setupCatalog.map((setup) => (
            <article key={setup.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs text-slate-400">{setup.phase} · {setup.side}</p>
              <h4 className="mt-1 font-medium text-slate-100">{setup.name}</h4>
              <p className="mt-2 text-sm text-slate-300">{setup.summary}</p>
            </article>
          ))}
          <article className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 md:col-span-2">
            <h4 className="font-medium text-slate-100">Lógica global del playbook</h4>
            <p className="mt-2 text-sm text-slate-300">
              Opera contexto + estructura + liquidez + catalizador. El patrón aislado no basta: el sistema valida fase, volumen, ejecución y riesgo de dilución antes de habilitar la operación.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
