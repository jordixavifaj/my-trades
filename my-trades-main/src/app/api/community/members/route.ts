import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUser } from '@/lib/request-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const memberships = await prisma.communityMember.findMany({
      where: { userId: auth.id },
      select: { communityId: true, community: { select: { id: true, name: true } } },
    });

    if (memberships.length === 0) {
      return NextResponse.json({ communities: [], members: [] });
    }

    const communityIds = memberships.map((m: any) => m.communityId);

    const allMembers = await prisma.communityMember.findMany({
      where: { communityId: { in: communityIds } },
      select: {
        userId: true,
        communityId: true,
        user: { select: { id: true, name: true, email: true, role: true } },
        community: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const communities = memberships.map((m: any) => m.community);

    return NextResponse.json({ communities, members: allMembers });
  } catch (error) {
    console.error('GET /api/community/members failed', error);
    return NextResponse.json({ error: 'Error al obtener miembros' }, { status: 500 });
  }
}
