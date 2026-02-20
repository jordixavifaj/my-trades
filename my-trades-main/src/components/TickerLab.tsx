'use client';

import { useCallback, useEffect, useState } from 'react';
import { TickerChart, TickerCandle } from '@/components/TickerChart';

type Profile = {
  symbol: string;
  exchange?: string | null;
  sector?: string | null;
  industry?: string | null;
  employees?: number | null;
  country?: string | null;
  marketCap?: number | null;
  float?: number | null;
  dilutionInfo?: string | null;
  ebitda?: number | null;
  shortInterestPercent?: number | null;
  yahooOk?: boolean;
  yahooError?: string | null;
  sources?: Record<string, boolean>;
  errors?: Record<string, string | null | undefined>;
  sourceUrls?: Record<string, string | null>;
};

type GapStats = {
  symbol: string;
  months: number;
  gapThresholdPercent: number;
  gapsCount: number;
  redAfterGapCount: number;
  redAfterGapPercent: number;
};

type NewsItem = {
  title?: string | null;
  description?: string | null;
  url?: string | null;
  publishedAt?: string | null;
  source?: string | null;
};

function formatLargeNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'N/A';
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-800/70 py-2 text-sm last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}

export function TickerLab({ initialSymbol = 'AAPL' }: { initialSymbol?: string }) {
  const initial = initialSymbol.toUpperCase();
  const [ticker, setTicker] = useState(initial);
  const [inputValue, setInputValue] = useState(initial);

  const INTERVALS = ['1m', '5m', '15m', '1h', '1d'] as const;
  const [chartInterval, setChartInterval] = useState<string>('5m');
  const [chartCandles, setChartCandles] = useState<TickerCandle[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [gaps, setGaps] = useState<GapStats | null>(null);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function readJsonSafe(res: Response): Promise<any> {
    const contentType = res.headers.get('content-type') ?? '';
    const text = await res.text();
    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(text);
      } catch {
        return { error: text };
      }
    }

    try {
      return JSON.parse(text);
    } catch {
      return { error: text };
    }
  }

  const refreshProfile = useCallback(async (symbol: string) => {
    const sym = symbol.toUpperCase();
    setError(null);
    setLoading(true);

    try {
      const [profileRes, gapsRes] = await Promise.all([
        fetch(`/api/ticker-lab/profile?symbol=${encodeURIComponent(sym)}`, { cache: 'no-store' }),
        fetch(`/api/ticker-lab/gaps?symbol=${encodeURIComponent(sym)}&months=9&gapThreshold=24`, { cache: 'no-store' }),
      ]);

      const [profileJson, gapsJson] = await Promise.all([
        readJsonSafe(profileRes),
        readJsonSafe(gapsRes),
      ]);

      if (!profileRes.ok) {
        console.error('TickerLab profile fetch failed', { status: profileRes.status, body: profileJson });
      }
      if (!gapsRes.ok) {
        console.error('TickerLab gaps fetch failed', { status: gapsRes.status, body: gapsJson });
      }

      setProfile(profileRes.ok ? profileJson : null);
      setGaps(gapsRes.ok ? gapsJson : null);
    } catch (e) {
      console.error('TickerLab refreshProfile failed', e);
      setError('No data available for this ticker.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshChart = useCallback(async (symbol: string, interval: string) => {
    const sym = symbol.toUpperCase();
    setChartLoading(true);
    try {
      const res = await fetch(
        `/api/ticker-lab/chart?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(interval)}`,
        { cache: 'no-store' },
      );
      const data = await readJsonSafe(res);
      if (!res.ok) {
        console.error('TickerLab chart fetch failed', { status: res.status, body: data });
        setChartCandles([]);
        return;
      }
      setChartCandles(Array.isArray(data.candles) ? data.candles : []);
    } catch (e) {
      console.error('TickerLab refreshChart failed', e);
      setChartCandles([]);
    } finally {
      setChartLoading(false);
    }
  }, []);

  const refreshNews = useCallback(async (symbol: string) => {
    const sym = symbol.toUpperCase();
    setNewsLoading(true);
    setNewsError(null);
    try {
      const res = await fetch(`/api/ticker-lab/news?symbol=${encodeURIComponent(sym)}`, { cache: 'no-store' });
      const data = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Error cargando noticias');
      }
      setNews(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setNews([]);
      console.error('TickerLab news fetch failed', e);
      setNewsError('No data available for this ticker.');
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfile(ticker);
    void refreshChart(ticker, chartInterval);
    void refreshNews(ticker);
  }, [ticker, refreshProfile, refreshChart, refreshNews, chartInterval]);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const next = inputValue.trim().toUpperCase();
      if (!next) return;
      setTicker(next);
    },
    [inputValue],
  );

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="panel-title">Ticker Lab</h2>
            <p className="mt-1 text-sm text-slate-400">Yahoo (yfinance) · gaps · operaciones importadas (XLS)</p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
            <label htmlFor="ticker-lab-input" className="text-sm text-slate-300">
              Ticker
            </label>
            <input
              id="ticker-lab-input"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value.toUpperCase())}
              placeholder="e.g. TSLA"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/70 transition focus:ring-2"
            />
            <button
              type="submit"
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20"
            >
              Actualizar
            </button>
          </form>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="panel p-5">
          <h3 className="panel-title mb-3">Info del ticker</h3>
          {loading && !profile && <p className="text-sm text-slate-400">Cargando…</p>}
          {error && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
              No data available for this ticker.
            </div>
          )}
          {!error && profile && (
            <div className="space-y-3">
              {profile.exchange === null &&
                profile.sector === null &&
                profile.industry === null &&
                profile.country === null &&
                profile.marketCap === null &&
                profile.float === null &&
                profile.ebitda === null &&
                profile.shortInterestPercent === null && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
                    No data available for this ticker.
                  </div>
                )}

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <Row label="Exchange" value={profile.exchange ?? 'N/A'} />
                <Row label="Sector" value={profile.sector ?? 'N/A'} />
                <Row label="Industry" value={profile.industry ?? 'N/A'} />
                <Row label="Country" value={profile.country ?? 'N/A'} />
                <Row label="Market Cap" value={formatLargeNumber(profile.marketCap ?? null)} />
                <Row label="Float" value={formatLargeNumber(profile.float ?? null)} />
                <Row label="EBITDA" value={formatLargeNumber(profile.ebitda ?? null)} />
                <Row
                  label="Short interest %"
                  value={profile.shortInterestPercent ? `${profile.shortInterestPercent.toFixed(2)}%` : 'N/A'}
                />
              </div>

              {profile.sources && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(profile.sources).map(([src, ok]) => (
                    <span
                      key={src}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {src}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <h3 className="panel-title mb-3 mt-6">Gap stats (≥24%)</h3>
          {!error && gaps && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <Row label="Gaps" value={String(gaps.gapsCount)} />
              <Row label="Red after gap" value={String(gaps.redAfterGapCount)} />
              <Row label="% red after gap" value={`${gaps.redAfterGapPercent.toFixed(2)}%`} />
              <Row label="Window" value={`${gaps.months} months`} />
            </div>
          )}
          {!error && !gaps && (
            <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-sm text-amber-200">
              Gap stats no disponibles. Reintenta en unos minutos.
            </div>
          )}
        </section>

        <section className="panel p-5 xl:col-span-2">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="panel-title">{ticker} · Gráfico</h3>
            <div className="flex items-center gap-1.5">
              {INTERVALS.map((iv) => (
                <button
                  key={iv}
                  onClick={() => setChartInterval(iv)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    chartInterval === iv
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-700/60 hover:text-slate-200'
                  }`}
                >
                  {iv}
                </button>
              ))}
            </div>
          </div>

          {chartLoading && (
            <div className="flex h-[500px] items-center justify-center rounded-xl border border-slate-800 bg-[#0a0e1a]">
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                <p className="text-sm text-slate-400">Cargando gráfico…</p>
              </div>
            </div>
          )}

          {!chartLoading && (
            <TickerChart candles={chartCandles} ticker={ticker} interval={chartInterval} />
          )}

          <div className="mt-5">
            <h3 className="panel-title mb-3">Recent News</h3>

            {newsLoading && <p className="text-sm text-slate-400">Cargando noticias…</p>}
            {!newsLoading && newsError && <p className="text-sm text-slate-300">No data available for this ticker.</p>}

            {!newsLoading && !newsError && news.length === 0 && (
              <p className="text-sm text-slate-400">No recent news found.</p>
            )}

            {!newsLoading && !newsError && news.length > 0 && (
              <div className="space-y-3">
                {news.map((item, idx) => (
                  <article key={`${item.url ?? 'news'}-${idx}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-100">{item.title ?? 'Untitled'}</h4>
                        {item.source && (
                          <span className="shrink-0 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
                            {item.source}
                          </span>
                        )}
                      </div>
                      {item.publishedAt && (
                        <p className="text-xs text-slate-500">
                          {new Date(item.publishedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {item.description && (
                      <p className="mt-2 line-clamp-3 text-sm text-slate-300">{item.description}</p>
                    )}
                    {item.url && (
                      <a
                        className="mt-2 inline-block truncate text-sm text-cyan-300 hover:text-cyan-200"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver artículo
                      </a>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
