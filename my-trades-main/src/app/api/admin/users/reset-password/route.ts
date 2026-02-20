import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUserWithFreshRole } from '@/lib/request-auth';
import { hashPassword } from '@/lib/auth';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
  }

  const body = await request.json();
  const userId = typeof body.userId === 'string' ? body.userId : '';

  if (!userId) {
    return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
  }

  // Generate a random temporary password
  const tempPassword = randomBytes(4).toString('hex'); // 8 chars hex e.g. "a3f1b2c9"

  try {
    const hashed = hashPassword(tempPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashed, mustResetPassword: true },
    });

    return NextResponse.json({
      ok: true,
      tempPassword,
      message: `Contraseña reseteada. Nueva contraseña temporal: ${tempPassword}`,
    });
  } catch (error) {
    console.error('POST /api/admin/users/reset-password failed', error);
    return NextResponse.json({ error: 'Error al resetear contraseña' }, { status: 500 });
  }
}
