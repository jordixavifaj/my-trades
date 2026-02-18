import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '@/lib/request-auth';
import * as cheerio from 'cheerio';

// Map of Finviz table keys to friendly names and optional normalization
const FINVIZ_FIELD_MAP: Record<string, { label: string; normalize?: (v: string) => any }> = {
  Ticker: { label: 'ticker' },
  Company: { label: 'company' },
  Sector: { label: 'sector' },
  Industry: { label: 'industry' },
  Country: { label: 'country' },
  'Market Cap': { label: 'marketCap', normalize: (v: string) => v },
  'P/E': { label: 'pe' },
  'Forward P/E': { label: 'forwardPe' },
  PEG: { label: 'peg' },
  'P/S': { label: 'ps' },
  'P/B': { label: 'pb' },
  'Price/Book': { label: 'priceBook' },
  'Price/Sales': { label: 'priceSales' },
  'Price/Cash': { label: 'priceCash' },
  'Price/Free Cash Flow': { label: 'priceFreeCashFlow' },
  EPS: { label: 'eps', normalize: (v: string) => parseFloat(v.replace(',', '')) },
  'EPS growth next 5 years': { label: 'epsGrowthNext5y' },
  'EPS growth this year': { label: 'epsGrowthThisYear' },
  'EPS growth next year': { label: 'epsGrowthNextYear' },
  'EPS growth past 5 years': { label: 'epsGrowthPast5y' },
  'Sales growth past 5 years': { label: 'salesGrowthPast5y' },
  'EPS growth qtr over qtr': { label: 'epsGrowthQoQ' },
  'Sales growth qtr over qtr': { label: 'salesGrowthQoQ' },
  Dividend: { label: 'dividend' },
  'Dividend %': { label: 'dividendYield' },
  'Shares Outstanding': { label: 'sharesOutstanding', normalize: (v: string) => parseLargeNumber(v) },
  'Float': { label: 'float', normalize: (v: string) => parseLargeNumber(v) },
  'Short Interest': { label: 'shortInterest' },
  'Short Interest %': { label: 'shortInterestPercent' },
  'Insider Ownership': { label: 'insiderOwnership' },
  'Insider Ownership %': { label: 'insiderOwnershipPercent' },
  'Institutional Ownership': { label: 'institutionalOwnership' },
  'Institutional Ownership %': { label: 'institutionalOwnershipPercent' },
  'Avg Volume': { label: 'avgVolume', normalize: (v: string) => parseLargeNumber(v) },
  'Volume': { label: 'volume', normalize: (v: string) => parseLargeNumber(v) },
  'Current Ratio': { label: 'currentRatio' },
  'Quick Ratio': { label: 'quickRatio' },
  'Debt/Eq': { label: 'debtToEquity' },
  'LT Debt/Eq': { label: 'ltDebtToEquity' },
  'Total Debt/Equity': { label: 'totalDebtToEquity' },
  'Gross Margin': { label: 'grossMargin' },
  'Operating Margin': { label: 'operatingMargin' },
  'Net Margin': { label: 'netMargin' },
  ROA: { label: 'roa' },
  ROE: { label: 'roe' },
  ROI: { label: 'roi' },
  'RSI (14)': { label: 'rsi14' },
  '52W Range': { label: 'week52Range' },
  '50-Day Moving Average': { label: 'ma50' },
  '200-Day Moving Average': { label: 'ma200' },
  'Change': { label: 'change' },
  'Change %': { label: 'changePercent' },
  'Performance (Week)': { label: 'perfWeek' },
  'Performance (Month)': { label: 'perfMonth' },
  'Performance (Quarter)': { label: 'perfQuarter' },
  'Performance (Half Year)': { label: 'perfHalfYear' },
  'Performance (Year)': { label: 'perfYear' },
  'Performance (YTD)': { label: 'perfYTD' },
  'Beta': { label: 'beta' },
  'Volatility (Week)': { label: 'volatilityWeek' },
  'Volatility (Month)': { label: 'volatilityMonth' },
  'Optionable': { label: 'optionable' },
  'Shortable': { label: 'shortable' },
  'Recom': { label: 'recom' },
  'Target Price': { label: 'targetPrice' },
  'Earnings Date': { label: 'earningsDate' },
  'IPO Date': { label: 'ipoDate' },
};

function parseLargeNumber(s: string): number {
  if (!s || typeof s !== 'string') return 0;
  const clean = s.replace(/[,|%]/g, '').trim().toUpperCase();
  if (clean === 'N/A' || clean === '') return 0;
  const match = clean.match(/^([\d.]+)([KMBT]?)/);
  if (!match) return parseFloat(clean) || 0;
  const num = parseFloat(match[1]);
  const suffix = match[2];
  const mult = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[suffix] ?? 1;
  return num * mult;
}

function normalizeValue(value: string, key: string): any {
  const field = FINVIZ_FIELD_MAP[key];
  if (!field) return value;
  if (field.normalize) return field.normalize(value);
  return value;
}

async function scrapeFinviz(ticker: string) {
  const url = `https://finviz.com/quote.ashx?t=${encodeURIComponent(ticker)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Finviz fetch error ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const result: Record<string, any> = {};

  // Full snapshot table (left side)
  $('table.snapshot-table2 tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length === 2) {
      const key = $(tds[0]).text().trim();
      const value = $(tds[1]).text().trim();
      const mapped = FINVIZ_FIELD_MAP[key];
      if (mapped) {
        result[mapped.label] = normalizeValue(value, key);
      } else {
        result[key] = value;
      }
    }
  });

  // Additional data from other tables if needed (e.g., news, insider, etc.)
  // For now, we return the snapshot data only.

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

  try {
    const data = await scrapeFinviz(ticker);
    return NextResponse.json({ ticker, data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error obteniendo datos de Finviz' },
      { status: 502 }
    );
  }
}
