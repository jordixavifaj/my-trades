import { NextResponse } from 'next/server';

import { EMPTY_FUNDAMENTALS, InternalTradingFundamentals } from '@/types/fundamentals';

const FMP_BASE = 'https://financialmodelingprep.com/api/v3';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { next: { revalidate: 600 } });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: { params: { symbol: string } }) {
  const symbol = params.symbol?.trim().toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required.' }, { status: 400 });
  }

  const fmpKey = process.env.FMP_API_KEY;
  const finnhubKey = process.env.FINNHUB_API_KEY;

  if (!fmpKey || !finnhubKey) {
    return NextResponse.json({ error: 'Fundamentals provider keys are not configured.' }, { status: 500 });
  }

  const [
    profileResponse,
    keyMetricsResponse,
    ratiosResponse,
    enterpriseValueResponse,
    growthResponse,
    incomeStatementTtmResponse,
    institutionalOwnershipResponse,
    insiderOwnershipResponse,
    insiderTransactionsResponse,
  ] = await Promise.all([
    fetchJson<Record<string, unknown>[]>(`${FMP_BASE}/profile/${encodeURIComponent(symbol)}?apikey=${fmpKey}`),
    fetchJson<Record<string, unknown>[]>(`${FMP_BASE}/key-metrics-ttm/${encodeURIComponent(symbol)}?apikey=${fmpKey}`),
    fetchJson<Record<string, unknown>[]>(`${FMP_BASE}/ratios-ttm/${encodeURIComponent(symbol)}?apikey=${fmpKey}`),
    fetchJson<Record<string, unknown>[]>(`${FMP_BASE}/enterprise-values/${encodeURIComponent(symbol)}?limit=1&apikey=${fmpKey}`),
    fetchJson<Record<string, unknown>[]>(`${FMP_BASE}/financial-growth/${encodeURIComponent(symbol)}?limit=1&apikey=${fmpKey}`),
    fetchJson<Record<string, unknown>[]>(`${FMP_BASE}/income-statement-ttm/${encodeURIComponent(symbol)}?apikey=${fmpKey}`),
    fetchJson<{ data?: Array<Record<string, unknown>> }>(`${FINNHUB_BASE}/stock/institutional-ownership?symbol=${encodeURIComponent(symbol)}&token=${finnhubKey}`),
    fetchJson<{ insiderOwnership?: number }>(`${FINNHUB_BASE}/stock/ownership?symbol=${encodeURIComponent(symbol)}&token=${finnhubKey}`),
    fetchJson<{ data?: Array<Record<string, unknown>> }>(`${FINNHUB_BASE}/stock/insider-transactions?symbol=${encodeURIComponent(symbol)}&token=${finnhubKey}`),
  ]);

  const profile = profileResponse?.[0] ?? null;
  const keyMetrics = keyMetricsResponse?.[0] ?? null;
  const ratios = ratiosResponse?.[0] ?? null;
  const enterpriseValue = enterpriseValueResponse?.[0] ?? null;
  const growth = growthResponse?.[0] ?? null;
  const incomeTtm = incomeStatementTtmResponse?.[0] ?? null;

  const institutionalData = institutionalOwnershipResponse?.data ?? [];
  const totalInstitutionalShares = institutionalData.reduce((acc, item) => {
    const shares = asNumber(item.shares);
    return acc + (shares ?? 0);
  }, 0);

  const insiderTransactions = (insiderTransactionsResponse?.data ?? []).slice(0, 10);

  const fundamentals: InternalTradingFundamentals = {
    ...EMPTY_FUNDAMENTALS,
    marketCap: asNumber(profile?.mktCap),
    enterpriseValue: asNumber(enterpriseValue?.enterpriseValue),
    sharesOutstanding: asNumber(profile?.sharesOutstanding),
    float: asNumber(keyMetrics?.floatShares),
    institutionalOwnership:
      asNumber(keyMetrics?.institutionalOwnership) ??
      (totalInstitutionalShares > 0 && asNumber(profile?.sharesOutstanding)
        ? (totalInstitutionalShares / (asNumber(profile?.sharesOutstanding) as number)) * 100
        : null),
    insiderOwnership: asNumber(insiderOwnershipResponse?.insiderOwnership) ?? asNumber(keyMetrics?.insiderOwnership),
    shortFloatPercent: asNumber(keyMetrics?.shortTermCoverageRatios) ?? asNumber(keyMetrics?.shortFloatPercent),
    shortInterest: asNumber(keyMetrics?.shortInterest),
    daysToCover: asNumber(keyMetrics?.daysSalesOutstanding) ?? asNumber(keyMetrics?.daysToCover),

    revenueTTM: asNumber(incomeTtm?.revenue),
    netIncomeTTM: asNumber(incomeTtm?.netIncome),
    ebitda: asNumber(incomeTtm?.ebitda),
    eps: asNumber(incomeTtm?.eps),
    revenueGrowthYoY: asNumber(growth?.revenueGrowth),
    debtToEquity: asNumber(ratios?.debtEquityRatio),

    exchange: asString(profile?.exchangeShortName) ?? asString(profile?.exchange),
    sector: asString(profile?.sector),
    industry: asString(profile?.industry),
    employees: asNumber(profile?.fullTimeEmployees),
    website: asString(profile?.website),
    description: asString(profile?.description),

    recentInsiderTransactions: insiderTransactions,
  };

  return NextResponse.json(fundamentals, { status: 200 });
}
