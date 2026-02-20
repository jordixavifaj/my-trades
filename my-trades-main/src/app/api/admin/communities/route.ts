import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUserWithFreshRole } from '@/lib/request-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  const communities = await prisma.community.findMany({
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ communities });
}

export async function POST(request: NextRequest) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : null;

  if (!name) {
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
  }

  try {
    const community = await prisma.community.create({
      data: { name, description },
    });
    return NextResponse.json(community, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe una comunidad con ese nombre' }, { status: 409 });
    }
    console.error('POST /api/admin/communities failed', error);
    return NextResponse.json({ error: 'Error al crear comunidad' }, { status: 500 });
  }
}
