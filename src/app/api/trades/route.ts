import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { requireRequestUser } from '@/lib/request-auth';
import { logError } from '@/lib/logger';
import { parseDate, parseInteger, parseNumber, parseString } from '@/lib/validation';

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? '20', 10)));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export async function GET(request: NextRequest) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = parsePagination(searchParams);

    const symbol = searchParams.get('symbol') ?? undefined;
    const status = searchParams.get('status') as 'OPEN' | 'CLOSED' | null;
    const strategyId = searchParams.get('strategyId') ?? undefined;
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where = {
      userId: auth.id,
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
  } catch (error) {
    logError('GET /api/trades failed', error, { userId: auth.id });
    return NextResponse.json({ error: 'No se pudieron consultar los trades' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const trade = await prisma.trade.create({
      data: {
        userId: auth.id,
        symbol: parseString(body.symbol, 'symbol', { minLength: 1, maxLength: 16 }).toUpperCase(),
        status: body.status,
        strategyId: body.strategyId ?? null,
        openDate: parseDate(body.openDate, 'openDate'),
        closeDate: body.closeDate ? parseDate(body.closeDate, 'closeDate') : null,
        openPrice: parseNumber(body.openPrice, 'openPrice', { min: 0 }),
        closePrice: body.closePrice ? parseNumber(body.closePrice, 'closePrice', { min: 0 }) : null,
        quantity: parseInteger(body.quantity, 'quantity', { min: 1 }),
        side: body.side,
        pnl: body.pnl !== undefined ? parseNumber(body.pnl, 'pnl', { allowNull: true }) : null,
        commission: parseNumber(body.commission ?? 0, 'commission', { min: 0 }),
        notes: body.notes ? parseString(body.notes, 'notes', { maxLength: 2000 }) : null,
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
  } catch (error) {
    logError('POST /api/trades failed', error, { userId: auth.id });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo crear el trade' }, { status: 400 });
  }
}
