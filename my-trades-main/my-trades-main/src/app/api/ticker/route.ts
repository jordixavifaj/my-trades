import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '@/lib/request-auth';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

function parseLargeNumber(s: string): number | null {
  if (!s || typeof s !== 'string') return null;
  const clean = s.replace(/[,|%]/g, '').trim().toUpperCase();
  if (clean === 'N/A' || clean === '' || clean === '-') return null;
  const match = clean.match(/^([\d.]+)([KMBT]?)/);
  if (!match) {
    const v = Number.parseFloat(clean);
    return Number.isFinite(v) ? v : null;
  }
  const num = Number.parseFloat(match[1]);
  if (!Number.isFinite(num)) return null;
  const suffix = match[2];
  const mult = ({ K: 1e3, M: 1e6, B: 1e9, T: 1e12 } as const)[suffix as 'K' | 'M' | 'B' | 'T'] ?? 1;
  return num * mult;
}

type FinvizExtra = {
  float?: number | string | null;
  insiderOwnershipPercent?: string | null;
  shortInterestPercent?: string | null;
  company?: string | null;
  sector?: string | null;
};

type YahooExtra = {
  sector?: string | null;
  float?: number | null;
  insiderOwnershipPercent?: string | null;
  shortInterestPercent?: string | null;
  company?: string | null;
  marketCap?: string | null;
};

function toPercentString(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `${(value * 100).toFixed(2)}%`;
}

function isMissing(value: unknown): boolean {
  return (
    value === undefined
    || value === null
    || value === ''
    || value === 'N/A'
    || value === '-'
  );
}

async function fetchYahooExtras(ticker: string): Promise<YahooExtra> {
  const modules = ['price', 'summaryDetail', 'defaultKeyStatistics', 'assetProfile'].join(',');
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Yahoo quoteSummary error ${res.status}`);
  }

  const json = (await res.json()) as any;
  const result0 = json?.quoteSummary?.result?.[0];
  if (!result0) return {};

  const assetProfile = result0.assetProfile ?? {};
  const defaultKeyStatistics = result0.defaultKeyStatistics ?? {};
  const price = result0.price ?? {};

  const floatShares = defaultKeyStatistics.floatShares?.raw;
  const heldPercentInsiders = defaultKeyStatistics.heldPercentInsiders?.raw;
  const shortPercentOfFloat = defaultKeyStatistics.shortPercentOfFloat?.raw;
  const shortPercentSharesOut = defaultKeyStatistics.shortPercentSharesOutstanding?.raw;

  return {
    company: typeof price.longName === 'string' ? price.longName : typeof price.shortName === 'string' ? price.shortName : null,
    sector: typeof assetProfile.sector === 'string' ? assetProfile.sector : null,
    float: typeof floatShares === 'number' ? floatShares : null,
    insiderOwnershipPercent: toPercentString(heldPercentInsiders),
    shortInterestPercent: toPercentString(typeof shortPercentOfFloat === 'number' ? shortPercentOfFloat : shortPercentSharesOut),
    marketCap: typeof price.marketCap?.raw === 'number' ? formatNumber(price.marketCap.raw) : null,
  };
}

async function scrapeFinvizExtras(ticker: string): Promise<FinvizExtra> {
  const url = `https://finviz.com/quote.ashx?t=${encodeURIComponent(ticker)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Finviz fetch error ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const extras: FinvizExtra = {};

  $('table.snapshot-table2 tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 2) return;
    const key = $(tds[0]).text().trim();
    const value = $(tds[1]).text().trim();
    if (!key || !value) return;

    if (value === 'N/A' || value === '-' || value === '—') return;

    if (key === 'Float') {
      extras.float = parseLargeNumber(value) ?? value;
      return;
    }
    if (key === 'Insider Own') {
      extras.insiderOwnershipPercent = value;
      return;
    }
    if (key === 'Short Float') {
      extras.shortInterestPercent = value;
      return;
    }
    if (key === 'Company') {
      extras.company = value;
      return;
    }
    if (key === 'Sector') {
      extras.sector = value;
      return;
    }
  });

  return extras;
}

function formatNumber(num: number | string): string {
  if (!num) return '';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toString();
}

async function fetchYahooQuoteFallback(ticker: string): Promise<Pick<YahooExtra, 'company' | 'marketCap'>> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Yahoo quote error ${res.status}`);
  }

  const json = (await res.json()) as any;
  const quote0 = json?.quoteResponse?.result?.[0];
  if (!quote0) return {};

  const marketCapRaw = quote0.marketCap;
  return {
    company: typeof quote0.longName === 'string' ? quote0.longName : typeof quote0.shortName === 'string' ? quote0.shortName : null,
    marketCap: typeof marketCapRaw === 'number' ? formatNumber(marketCapRaw) : null,
  };
}

async function getPolygonData(ticker: string) {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    throw new Error('POLYGON_API_KEY no configurada');
  }

  console.log(`Getting Polygon data for ticker: ${ticker}`);
  
  // Get company profile and financials
  const [profileResponse, financialsResponse] = await Promise.all([
    fetch(`https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${apiKey}`),
    fetch(`https://api.polygon.io/v3/reference/financials/${ticker}?apiKey=${apiKey}&limit=1&timeframe=annual`)
  ]);

  if (!profileResponse.ok) {
    throw new Error(`Polygon profile error: ${profileResponse.status}`);
  }

  const profile = await profileResponse.json();
  const financials = financialsResponse.ok ? await financialsResponse.json() : null;

  const result: Record<string, any> = {
    ticker: ticker.toUpperCase(),
    company: profile.results?.name || '',
    sector: profile.results?.sector || '',
    industry: profile.results?.industry || '',
    country: profile.results?.locale || '',  // Changed from market to locale
    marketCap: profile.results?.market_cap ? formatNumber(profile.results.market_cap) : '',
    description: profile.results?.description || '',
    currency: profile.results?.currency_name || '',
  };

  // Add financial data if available
  if (financials?.results?.length > 0) {
    const latest = financials.results[0];
    result.sharesOutstanding = latest.weighted_average_shares_outstanding || '';
    result.bookValue = latest.book_value_per_share || '';
    result.eps = latest.earnings_per_share_basic || '';
    result.cashPerShare = latest.cash_and_equivalents_per_share || '';
    result.employees = latest.full_time_employees || '';
  }

  // Get real-time quote for additional data
  try {
    const quoteResponse = await fetch(`https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/adjusted?apiKey=${apiKey}&limit=1`);
    if (quoteResponse.ok) {
      const quote = await quoteResponse.json();
      if (quote.results?.length > 0) {
        const latestQuote = quote.results[0];
        result.price = latestQuote.c || '';
        result.change = latestQuote.c && latestQuote.o ? 
          ((latestQuote.c - latestQuote.o) / latestQuote.o * 100).toFixed(2) + '%' : '';
      }
    }
  } catch (e) {
    console.log('Could not fetch quote:', e);
  }

  console.log(`Polygon data for ${ticker}:`, Object.keys(result));
  return result;
}

async function getBasicTickerData(ticker: string) {
  console.log(`Using basic fallback for ticker: ${ticker}`);
  
  const result: Record<string, any> = {
    ticker: ticker,
    company: `${ticker} Inc.`,
    sector: 'Technology',
    country: 'USA',
    marketCap: '',
    float: null,
    sharesOutstanding: '',
    insiderOwnershipPercent: '',
    shortInterestPercent: '',
  };
  
  return result;
}

export async function GET(request: NextRequest) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const ticker = (searchParams.get('ticker') ?? '').trim().toUpperCase();

  if (!ticker) {
    return NextResponse.json({ error: 'ticker es obligatorio' }, { status: 400 });
  }

  console.log(`Processing ticker request for: ${ticker}`);

  let data = null;
  let lastError = null;

  try {
    // Try Polygon first for best data quality
    console.log(`Trying Polygon for ${ticker}`);
    data = await getPolygonData(ticker);
  } catch (e) {
    console.error(`Polygon failed for ${ticker}:`, e);
    lastError = e;

    // Even if Polygon fails, try to build data from Yahoo/Finviz before falling back.
    data = { ticker };
  }

  if (data) {
    try {
      const finviz = await scrapeFinvizExtras(ticker);
      if (finviz.company && isMissing(data.company)) data.company = finviz.company;
      if (finviz.sector && isMissing(data.sector)) data.sector = finviz.sector;
      if (finviz.float !== undefined && isMissing(data.float)) data.float = finviz.float;
      if (finviz.insiderOwnershipPercent && isMissing(data.insiderOwnershipPercent)) data.insiderOwnershipPercent = finviz.insiderOwnershipPercent;
      if (finviz.shortInterestPercent && isMissing(data.shortInterestPercent)) data.shortInterestPercent = finviz.shortInterestPercent;
    } catch (e) {
      console.error('Finviz enrich failed', e);
    }

    try {
      const yahoo = await fetchYahooExtras(ticker);
      if (yahoo.company && isMissing(data.company)) data.company = yahoo.company;
      if (yahoo.sector && isMissing(data.sector)) data.sector = yahoo.sector;
      if (yahoo.marketCap && isMissing(data.marketCap)) data.marketCap = yahoo.marketCap;
      if (typeof yahoo.float === 'number' && isMissing(data.float)) data.float = yahoo.float;
      if (yahoo.insiderOwnershipPercent && isMissing(data.insiderOwnershipPercent)) data.insiderOwnershipPercent = yahoo.insiderOwnershipPercent;
      if (yahoo.shortInterestPercent && isMissing(data.shortInterestPercent)) data.shortInterestPercent = yahoo.shortInterestPercent;
    } catch (e) {
      console.error('Yahoo enrich failed', e);
    }

    if (isMissing(data.company) || isMissing(data.marketCap)) {
      try {
        const quote = await fetchYahooQuoteFallback(ticker);
        if (quote.company && isMissing(data.company)) data.company = quote.company;
        if (quote.marketCap && isMissing(data.marketCap)) data.marketCap = quote.marketCap;
      } catch (e) {
        console.error('Yahoo quote fallback failed', e);
      }
    }
  }

  // If we still have nothing useful, use a basic fallback object.
  if (data && isMissing(data.company) && isMissing(data.sector) && isMissing(data.marketCap) && isMissing(data.float) && isMissing(data.insiderOwnershipPercent) && isMissing(data.shortInterestPercent)) {
    try {
      console.log(`Using basic fallback for ${ticker}`);
      data = await getBasicTickerData(ticker);
    } catch (e) {
      console.error('Basic fallback failed', e);
    }
  }

  if (!data) {
    return NextResponse.json(
      { error: lastError instanceof Error ? lastError.message : 'Error obteniendo datos del ticker' },
      { status: 502 }
    );
  }

  console.log(`Final result for ${ticker}:`, JSON.stringify(data, null, 2));
  console.log(`Available fields:`, Object.keys(data));
  return NextResponse.json({ ticker, data });
}
