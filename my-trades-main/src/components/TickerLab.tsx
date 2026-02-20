'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { JournalChart, JournalCandle, JournalTrade } from '@/components/JournalChart';

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

  const [selected, setSelected] = useState<{ date: string; symbol: string } | null>(null);

  const [chartDate, setChartDate] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });

  const [profile, setProfile] = useState<Profile | null>(null);
  const [gaps, setGaps] = useState<GapStats | null>(null);
  const [candles, setCandles] = useState<JournalCandle[]>([]);
  const [trades, setTrades] = useState<JournalTrade[]>([]);

  const [useTradingViewFallback, setUseTradingViewFallback] = useState(false);

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

  const resolveDefaultDateForTicker = useCallback(async (symbol: string) => {
    try {
      const res = await fetch(
        `/api/dashboard/last-trade-date?symbol=${encodeURIComponent(symbol.toUpperCase())}`,
        { cache: 'no-store' },
      );
      const data = await readJsonSafe(res);
      if (!res.ok) return null;
      return typeof data.date === 'string' && data.date ? data.date : null;
    } catch {
      return null;
    }
  }, []);

  const refreshAll = useCallback(async (symbol: string, date?: string) => {
    const sym = symbol.toUpperCase();

    setError(null);
    setLoading(true);
    setUseTradingViewFallback(false);

    try {
      const chosenDate = date ?? chartDate;

      const profileReq = fetch(`/api/ticker-lab/profile?symbol=${encodeURIComponent(sym)}`, { cache: 'no-store' });
      const gapsReq = fetch(`/api/ticker-lab/gaps?symbol=${encodeURIComponent(sym)}&months=9&gapThreshold=24`, { cache: 'no-store' });

      const intradayReq = chosenDate
        ? fetch(`/api/yahoo/intraday?symbol=${encodeURIComponent(sym)}&date=${encodeURIComponent(chosenDate)}`, { cache: 'no-store' })
        : null;

      const tradesReq = chosenDate
        ? fetch(`/api/dashboard/trades?symbol=${encodeURIComponent(sym)}&date=${encodeURIComponent(chosenDate)}`, { cache: 'no-store' })
        : null;

      const [profileRes, gapsRes, intradayRes, tradesRes] = await Promise.all([
        profileReq,
        gapsReq,
        intradayReq,
        tradesReq,
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

      if (intradayRes && tradesRes) {
        const [intradayJson, tradesJson] = await Promise.all([
          readJsonSafe(intradayRes),
          readJsonSafe(tradesRes),
        ]);

        if (!tradesRes.ok) {
          console.error('TickerLab trades fetch failed', { status: tradesRes.status, body: tradesJson });
          throw new Error('No data available for this ticker.');
        }

        if (!intradayRes.ok) {
          console.error('TickerLab intraday fetch failed', { status: intradayRes.status, body: intradayJson });
          // Still show executions using synthetic candles.
          setCandles([]);
          setTrades(tradesJson.trades ?? []);
          setUseTradingViewFallback(false);
          return;
        }

        const nextCandles = intradayJson.candles ?? [];
        setCandles(nextCandles);
        setTrades(tradesJson.trades ?? []);
        // Even if candles are empty, JournalChart can render executions with synthetic candles.
        setUseTradingViewFallback(false);
      } else {
        setCandles([]);
        setTrades([]);
        setUseTradingViewFallback(false);
      }
    } catch (e) {
      // Do not expose technical errors to the UI.
      console.error('TickerLab refreshAll failed', e);
      setError('No data available for this ticker.');
      setUseTradingViewFallback(false);
    } finally {
      setLoading(false);
    }
  }, [chartDate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nextDate = await resolveDefaultDateForTicker(ticker);
      if (cancelled) return;
      if (nextDate && nextDate !== chartDate) {
        setChartDate(nextDate);
        setSelected({ symbol: ticker.toUpperCase(), date: nextDate });
        await refreshAll(ticker.toUpperCase(), nextDate);
      } else {
        await refreshAll(ticker);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker, refreshAll, resolveDefaultDateForTicker]);

  useEffect(() => {
    setSelected({ symbol: ticker.toUpperCase(), date: chartDate });
    void refreshAll(ticker.toUpperCase(), chartDate);
  }, [chartDate, refreshAll, ticker]);

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
    void refreshNews(ticker);
  }, [refreshNews, ticker]);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const next = inputValue.trim().toUpperCase();
      if (!next) return;
      setTicker(next);
    },
    [inputValue],
  );

  const selectedTitle = useMemo(() => {
    if (!selected) return null;
    return `${selected.symbol} · ${selected.date}`;
  }, [selected]);

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
                profile.employees === null &&
                profile.country === null &&
                profile.marketCap === null &&
                profile.float === null &&
                profile.dilutionInfo === null &&
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
                <Row label="Employees" value={formatLargeNumber(profile.employees ?? null)} />
                <Row label="Country" value={profile.country ?? 'N/A'} />
                <Row label="Market Cap" value={formatLargeNumber(profile.marketCap ?? null)} />
                <Row label="Float" value={formatLargeNumber(profile.float ?? null)} />
                <Row label="Dilution" value={profile.dilutionInfo ?? 'N/A'} />
                <Row label="EBITDA" value={formatLargeNumber(profile.ebitda ?? null)} />
                <Row
                  label="Short interest %"
                  value={profile.shortInterestPercent ? `${profile.shortInterestPercent.toFixed(2)}%` : 'N/A'}
                />
              </div>
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
            <h3 className="panel-title">Gráfico intradía (Yahoo 1m) + ejecuciones</h3>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-300" htmlFor="ticker-lab-date">
                Fecha
              </label>
              <input
                id="ticker-lab-date"
                type="date"
                value={chartDate}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setChartDate(nextDate);
                  setSelected({ symbol: ticker.toUpperCase(), date: nextDate });
                  void refreshAll(ticker.toUpperCase(), nextDate);
                }}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              {selectedTitle && <span className="text-sm text-slate-400">{selectedTitle}</span>}
            </div>
          </div>

          {!selected && (
            <div className="flex h-[600px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60">
              <p className="text-sm text-slate-400">Selecciona una fecha para cargar el gráfico.</p>
            </div>
          )}

          {selected && loading && (
            <div className="flex h-[600px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                <p className="text-sm text-slate-400">Cargando datos…</p>
              </div>
            </div>
          )}

          {selected && !loading && error && (
            <div className="flex h-[600px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60">
              <p className="text-sm text-slate-300">No data available for this ticker.</p>
            </div>
          )}

          {selected && !loading && !error && (
            <JournalChart candles={candles} trades={trades} ticker={selected.symbol} date={selected.date} />
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
                      <h4 className="text-sm font-semibold text-slate-100">{item.title ?? 'Untitled'}</h4>
                      {(item.source || item.publishedAt) && (
                        <p className="text-xs text-slate-500">
                          {item.source ? item.source : ''}
                          {item.source && item.publishedAt ? ' · ' : ''}
                          {item.publishedAt ? new Date(item.publishedAt).toLocaleString() : ''}
                        </p>
                      )}
                    </div>
                    {item.description && (
                      <p className="mt-2 line-clamp-4 text-sm text-slate-300">{item.description}</p>
                    )}
                    {item.url && (
                      <a
                        className="mt-3 inline-block text-sm text-cyan-300 hover:text-cyan-200"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.url}
                      </a>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="panel p-5">
        <h3 className="panel-title mb-2">TradingView Charting Library (opcional)</h3>
        <p className="text-sm text-slate-400">
          Este panel se deja como stub. La TradingView Charting Library requiere licencia y distribución privada.
        </p>
      </section>
    </div>
  );
}
