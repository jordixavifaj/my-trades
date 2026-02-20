import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUser } from '@/lib/request-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? '20', 10)));
  const symbol = searchParams.get('symbol') ?? undefined;
  const memberId = searchParams.get('memberId') ?? undefined;

  try {
    // Find all communities the current user belongs to
    const memberships = await prisma.communityMember.findMany({
      where: { userId: auth.id },
      select: { communityId: true },
    });

    if (memberships.length === 0) {
      return NextResponse.json({
        items: [],
        page,
        pageSize,
        total: 0,
        pages: 0,
        communities: [],
      });
    }

    const communityIds = memberships.map((m) => m.communityId);

    // Get all member userIds in those communities (excluding self)
    const fellowMembers = await prisma.communityMember.findMany({
      where: {
        communityId: { in: communityIds },
        userId: { not: auth.id },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    const memberUserIds = fellowMembers.map((m) => m.userId);

    if (memberUserIds.length === 0) {
      return NextResponse.json({
        items: [],
        page,
        pageSize,
        total: 0,
        pages: 0,
        communities: [],
      });
    }

    // Build where clause: trades from fellow community members
    const where: Record<string, unknown> = {
      userId: memberId && memberUserIds.includes(memberId) ? memberId : { in: memberUserIds },
      status: 'CLOSED',
    };

    if (symbol) {
      where.symbol = { contains: symbol, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        select: {
          id: true,
          symbol: true,
          side: true,
          openDate: true,
          closeDate: true,
          openPrice: true,
          closePrice: true,
          quantity: true,
          pnl: true,
          commission: true,
          status: true,
          strategy: { select: { name: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { closeDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.trade.count({ where }),
    ]);

    // Get community info
    const communities = await prisma.community.findMany({
      where: { id: { in: communityIds }, isActive: true },
      select: { id: true, name: true, description: true },
    });

    return NextResponse.json({
      items,
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize),
      communities,
    });
  } catch (error) {
    console.error('GET /api/community/trades failed', error);
    return NextResponse.json({ error: 'Error al obtener trades de la comunidad' }, { status: 500 });
  }
}
