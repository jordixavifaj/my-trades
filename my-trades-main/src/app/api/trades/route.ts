import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { requireRequestUser } from '@/lib/request-auth';

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? '20', 10)));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export async function GET(request: NextRequest) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, skip } = parsePagination(searchParams);

  const symbol = searchParams.get('symbol') ?? undefined;
  const status = searchParams.get('status') as 'OPEN' | 'CLOSED' | null;
  const strategyId = searchParams.get('strategyId') ?? undefined;
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const where = {
    symbol: symbol ? { contains: symbol, mode: 'insensitive' as const } : undefined,
    status: status === 'OPEN' || status === 'CLOSED' ? status : undefined,
    strategyId: strategyId || undefined,
    openDate: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
  };

  const [items, total] = await Promise.all([
    prisma.trade.findMany({ where, include: { strategy: true, fills: true }, orderBy: { openDate: 'desc' }, skip, take: pageSize }),
    prisma.trade.count({ where }),
  ]);

  return NextResponse.json({ items, page, pageSize, total, pages: Math.ceil(total / pageSize) });
}

export async function POST(request: NextRequest) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const trade = await prisma.trade.create({
    data: {
      userId: auth.id,
      symbol: body.symbol,
      status: body.status,
      strategyId: body.strategyId ?? null,
      openDate: new Date(body.openDate),
      closeDate: body.closeDate ? new Date(body.closeDate) : null,
      openPrice: Number(body.openPrice),
      closePrice: body.closePrice ? Number(body.closePrice) : null,
      quantity: Number(body.quantity),
      side: body.side,
      pnl: body.pnl !== undefined ? Number(body.pnl) : null,
      commission: Number(body.commission ?? 0),
      notes: body.notes ?? null,
    },
  });

  await createAuditLog({
    userId: auth.id,
    tradeId: trade.id,
    action: 'TRADE_CREATE',
    reason: body.reason ?? 'manual_create',
    newValue: trade,
  });

  return NextResponse.json(trade, { status: 201 });
}
