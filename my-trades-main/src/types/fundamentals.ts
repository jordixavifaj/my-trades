export interface InternalTradingFundamentals {
  marketCap: number | null;
  enterpriseValue: number | null;
  sharesOutstanding: number | null;
  float: number | null;
  institutionalOwnership: number | null;
  insiderOwnership: number | null;
  shortFloatPercent: number | null;
  shortInterest: number | null;
  daysToCover: number | null;

  revenueTTM: number | null;
  netIncomeTTM: number | null;
  ebitda: number | null;
  eps: number | null;
  revenueGrowthYoY: number | null;
  debtToEquity: number | null;

  exchange: string | null;
  sector: string | null;
  industry: string | null;
  employees: number | null;
  website: string | null;
  description: string | null;

  recentInsiderTransactions?: any[];
}

export const EMPTY_FUNDAMENTALS: InternalTradingFundamentals = {
  marketCap: null,
  enterpriseValue: null,
  sharesOutstanding: null,
  float: null,
  institutionalOwnership: null,
  insiderOwnership: null,
  shortFloatPercent: null,
  shortInterest: null,
  daysToCover: null,
  revenueTTM: null,
  netIncomeTTM: null,
  ebitda: null,
  eps: null,
  revenueGrowthYoY: null,
  debtToEquity: null,
  exchange: null,
  sector: null,
  industry: null,
  employees: null,
  website: null,
  description: null,
  recentInsiderTransactions: [],
};
