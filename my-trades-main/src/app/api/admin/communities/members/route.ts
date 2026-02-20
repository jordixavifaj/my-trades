import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUserWithFreshRole } from '@/lib/request-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const communityId = searchParams.get('communityId');

  if (!communityId) {
    return NextResponse.json({ error: 'communityId requerido' }, { status: 400 });
  }

  const members = await prisma.communityMember.findMany({
    where: { communityId },
    select: {
      userId: true,
      joinedAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { joinedAt: 'asc' },
  });

  return NextResponse.json({ members });
}

export async function POST(request: NextRequest) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const communityId = typeof body.communityId === 'string' ? body.communityId : '';
  const userId = typeof body.userId === 'string' ? body.userId : '';

  if (!communityId || !userId) {
    return NextResponse.json({ error: 'communityId y userId requeridos' }, { status: 400 });
  }

  try {
    const member = await prisma.communityMember.create({
      data: { communityId, userId },
    });
    return NextResponse.json(member, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'El usuario ya es miembro de esta comunidad' }, { status: 409 });
    }
    if (error?.code === 'P2003') {
      return NextResponse.json({ error: 'Comunidad o usuario no encontrado' }, { status: 404 });
    }
    console.error('POST /api/admin/communities/members failed', error);
    return NextResponse.json({ error: 'Error al agregar miembro' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const communityId = searchParams.get('communityId');
  const userId = searchParams.get('userId');

  if (!communityId || !userId) {
    return NextResponse.json({ error: 'communityId y userId requeridos' }, { status: 400 });
  }

  try {
    await prisma.communityMember.deleteMany({
      where: { communityId, userId },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/admin/communities/members failed', error);
    return NextResponse.json({ error: 'Error al eliminar miembro' }, { status: 500 });
  }
}
