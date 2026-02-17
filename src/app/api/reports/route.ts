import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUser } from '@/lib/request-auth';

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const value = row[h] == null ? '' : String(row[h]);
          return value.includes(',') || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(','),
    );
  }
  return lines.join('\n');
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function createSimplePdf(lines: string[]) {
  const safeLines = lines.slice(0, 60);
  const contentLines = ['BT', '/F1 10 Tf', '50 780 Td'];

  safeLines.forEach((line, index) => {
    if (index > 0) contentLines.push('0 -14 Td');
    contentLines.push(`(${pdfEscape(line)}) Tj`);
  });

  contentLines.push('ET');
  const stream = contentLines.join('\n');

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream endobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${object}\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}

function parseWhere(searchParams: URLSearchParams) {
  const symbol = searchParams.get('symbol') ?? undefined;
  const status = searchParams.get('status') as 'OPEN' | 'CLOSED' | null;
  const strategyId = searchParams.get('strategyId') ?? undefined;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  return {
    symbol: symbol ? { contains: symbol, mode: 'insensitive' as const } : undefined,
    status: status === 'OPEN' || status === 'CLOSED' ? status : undefined,
    strategyId,
    openDate: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
  };
}

export async function GET(request: NextRequest) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get('export');
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? '20', 10)));
    const where = parseWhere(searchParams);

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        include: { strategy: true },
        orderBy: { openDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.trade.count({ where }),
    ]);

    const byStrategy = Object.values(
      trades.reduce<Record<string, { strategy: string; trades: number; pnl: number }>>((acc, trade) => {
        const key = trade.strategy?.name ?? 'Sin estrategia';
        if (!acc[key]) {
          acc[key] = { strategy: key, trades: 0, pnl: 0 };
        }
        acc[key].trades += 1;
        acc[key].pnl += (trade.pnl ?? 0) - trade.commission;
        return acc;
      }, {}),
    );

    if (exportType === 'excel') {
      const csv = toCsv(
        trades.map((trade) => ({
          symbol: trade.symbol,
          status: trade.status,
          strategy: trade.strategy?.name ?? '',
          openDate: trade.openDate.toISOString(),
          closeDate: trade.closeDate?.toISOString() ?? '',
          pnl: ((trade.pnl ?? 0) - trade.commission).toFixed(2),
        })),
      );
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="trades-report.csv"',
        },
      });
    }

    if (exportType === 'pdf') {
      const pdf = createSimplePdf([
        'MY TRADES REPORT',
        `Generated: ${new Date().toISOString()}`,
        `Total rows: ${trades.length}`,
        ...trades.map((t) => `${t.symbol} | ${t.status} | ${((t.pnl ?? 0) - t.commission).toFixed(2)}`),
      ]);

      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="trades-report.pdf"',
        },
      });
    }

    return NextResponse.json({
      totalTrades: total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
      byStrategy,
      trades,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudo generar reporte' }, { status: 500 });
  }
}
