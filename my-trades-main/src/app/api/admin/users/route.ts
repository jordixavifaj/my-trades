import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUserWithFreshRole } from '@/lib/request-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role') ?? undefined;
  const search = searchParams.get('search') ?? undefined;

  const where: Record<string, unknown> = {};
  if (role) where.role = role;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { trades: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  return NextResponse.json({ users });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const role = typeof body.role === 'string' ? body.role : '';

  if (!userId || !role) {
    return NextResponse.json({ error: 'userId y role requeridos' }, { status: 400 });
  }

  const validRoles = ['ADMIN', 'TRADER', 'MENTOR', 'STUDENT'];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: `Role inválido. Opciones: ${validRoles.join(', ')}` }, { status: 400 });
  }

  if (userId === auth.id && role !== 'ADMIN') {
    return NextResponse.json({ error: 'No puedes cambiar tu propio rol de ADMIN' }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
    return NextResponse.json(user);
  } catch (error) {
    console.error('PATCH /api/admin/users failed', error);
    return NextResponse.json({ error: 'Error al actualizar rol' }, { status: 500 });
  }
}
