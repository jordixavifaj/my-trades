import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireRequestUserWithFreshRole } from '@/lib/request-auth';

export const runtime = 'nodejs';

// GET /api/admin/invite-codes — List all codes with optional filters
export async function GET(request: NextRequest) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'ADMIN') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // 'used' | 'available' | ''
  const search = searchParams.get('search')?.trim().toLowerCase() || '';

  const where: Record<string, unknown> = {};

  if (status === 'used') where.used = true;
  else if (status === 'available') where.used = false;

  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { assignedEmail: { contains: search, mode: 'insensitive' } },
      { usedByEmail: { contains: search, mode: 'insensitive' } },
    ];
  }

  const codes = await prisma.inviteCode.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      usedByUser: { select: { id: true, name: true, email: true } },
    },
  });

  const stats = {
    total: await prisma.inviteCode.count(),
    used: await prisma.inviteCode.count({ where: { used: true } }),
    available: await prisma.inviteCode.count({ where: { used: false } }),
  };

  return NextResponse.json({ codes, stats });
}

// POST /api/admin/invite-codes — Generate new codes
export async function POST(request: NextRequest) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'ADMIN') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const count = Math.min(Math.max(Number(body?.count) || 1, 1), 100);
  const assignedEmail = typeof body?.assignedEmail === 'string' ? body.assignedEmail.trim().toLowerCase() || null : null;

  const generated: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = randomBytes(4).toString('hex').toUpperCase(); // 8 char hex code
    await prisma.inviteCode.create({
      data: {
        code,
        assignedEmail,
      },
    });
    generated.push(code);
  }

  return NextResponse.json({ generated, count: generated.length }, { status: 201 });
}

// DELETE /api/admin/invite-codes — Delete an unused code
export async function DELETE(request: NextRequest) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'ADMIN') return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

  const code = await prisma.inviteCode.findUnique({ where: { id } });
  if (!code) return NextResponse.json({ error: 'Código no encontrado' }, { status: 404 });
  if (code.used) return NextResponse.json({ error: 'No se puede eliminar un código ya usado' }, { status: 400 });

  await prisma.inviteCode.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
