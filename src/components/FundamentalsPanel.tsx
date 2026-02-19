'use client';

import { InternalTradingFundamentals } from '@/types/fundamentals';

function formatLargeNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';

  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)}K`;

  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  return `${value.toFixed(2)}%`;
}

function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  return value.toFixed(2);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-800/70 py-2 text-sm last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}

export function FundamentalsPanel({
  fundamentals,
  loading,
  error,
}: {
  fundamentals: InternalTradingFundamentals | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return <section className="panel p-4 text-sm text-slate-300">Loading fundamentals…</section>;
  }

  if (error) {
    return <section className="panel p-4 text-sm text-amber-300">Fundamentals unavailable right now. {error}</section>;
  }

  if (!fundamentals) {
    return <section className="panel p-4 text-sm text-slate-300">No fundamentals found.</section>;
  }

  return (
    <section className="panel p-4">
      <h3 className="mb-3 text-lg font-semibold tracking-tight">Fundamentals</h3>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <h4 className="mb-2 text-sm font-semibold text-cyan-300">Market Structure</h4>
          <Row label="Market Cap" value={formatLargeNumber(fundamentals.marketCap)} />
          <Row label="Enterprise Value" value={formatLargeNumber(fundamentals.enterpriseValue)} />
          <Row label="Float" value={formatLargeNumber(fundamentals.float)} />
          <Row label="Shares Outstanding" value={formatLargeNumber(fundamentals.sharesOutstanding)} />
          <Row label="Short Float %" value={formatPercent(fundamentals.shortFloatPercent)} />
          <Row label="Institutional Ownership %" value={formatPercent(fundamentals.institutionalOwnership)} />
          <Row label="Insider Ownership %" value={formatPercent(fundamentals.insiderOwnership)} />
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <h4 className="mb-2 text-sm font-semibold text-cyan-300">Financial Strength</h4>
          <Row label="Revenue TTM" value={formatLargeNumber(fundamentals.revenueTTM)} />
          <Row label="Net Income TTM" value={formatLargeNumber(fundamentals.netIncomeTTM)} />
          <Row label="EBITDA" value={formatLargeNumber(fundamentals.ebitda)} />
          <Row label="EPS" value={formatRatio(fundamentals.eps)} />
          <Row label="Revenue Growth YoY" value={formatPercent(fundamentals.revenueGrowthYoY)} />
          <Row label="Debt to Equity" value={formatRatio(fundamentals.debtToEquity)} />
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 lg:col-span-2">
          <h4 className="mb-2 text-sm font-semibold text-cyan-300">Smart Money</h4>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Change</th>
                  <th className="px-3 py-2">Shares</th>
                  <th className="px-3 py-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {(fundamentals.recentInsiderTransactions ?? []).length ? (
                  (fundamentals.recentInsiderTransactions ?? []).map((tx: Record<string, unknown>, idx) => (
                    <tr key={`${String(tx.filingDate ?? idx)}-${idx}`} className="border-t border-slate-800/80">
                      <td className="px-3 py-2 text-slate-200">{String(tx.name ?? 'N/A')}</td>
                      <td className="px-3 py-2 text-slate-300">{String(tx.transactionDate ?? tx.filingDate ?? 'N/A')}</td>
                      <td className="px-3 py-2 text-slate-300">{String(tx.change ?? tx.transactionCode ?? 'N/A')}</td>
                      <td className="px-3 py-2 text-slate-300">{formatLargeNumber(Number(tx.share ?? tx.shares ?? NaN))}</td>
                      <td className="px-3 py-2 text-slate-300">{formatRatio(Number(tx.transactionPrice ?? NaN))}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-3 text-slate-400" colSpan={5}>
                      No recent insider transactions available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 lg:col-span-2">
          <h4 className="mb-2 text-sm font-semibold text-cyan-300">Company Info</h4>
          <div className="grid gap-x-6 md:grid-cols-2">
            <Row label="Exchange" value={fundamentals.exchange ?? 'N/A'} />
            <Row label="Sector" value={fundamentals.sector ?? 'N/A'} />
            <Row label="Industry" value={fundamentals.industry ?? 'N/A'} />
            <Row label="Employees" value={formatLargeNumber(fundamentals.employees)} />
            <Row label="Website" value={fundamentals.website ?? 'N/A'} />
          </div>
          <p className="mt-3 text-sm text-slate-300">{fundamentals.description ?? 'N/A'}</p>
        </div>
      </div>
    </section>
  );
}
