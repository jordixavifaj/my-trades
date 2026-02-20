import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, createSessionToken, sessionCookie, toSessionRole } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const userId = typeof body?.userId === 'string' ? body.userId : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
  const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';

  if (!userId || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'Las contraseñas no coinciden' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (!(user as any).mustResetPassword) {
      return NextResponse.json({ error: 'Este usuario no necesita cambiar contraseña' }, { status: 400 });
    }

    const hashed = hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashed, mustResetPassword: false } as any,
    });

    // Auto-login after password change
    const token = createSessionToken({ id: user.id, email: user.email, role: toSessionRole(user.role) });
    const response = NextResponse.json({ ok: true, id: user.id, email: user.email, role: toSessionRole(user.role) });
    const cookie = sessionCookie(token);
    response.cookies.set(cookie.name, cookie.value, cookie.options);

    return response;
  } catch (error) {
    console.error('POST /api/auth/change-password failed', error);
    return NextResponse.json({ error: 'Error al cambiar contraseña' }, { status: 500 });
  }
}
