import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSessionToken, sessionCookie, verifyPassword } from '@/lib/auth';
import { logError, logInfo } from '@/lib/logger';
import { parseString } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = parseString(body?.email, 'email', { minLength: 5, maxLength: 255 }).toLowerCase();
    const password = parseString(body?.password, 'password', { minLength: 1, maxLength: 128 });

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !verifyPassword(password, user.passwordHash) || !user.isActive) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const token = createSessionToken({ id: user.id, email: user.email, role: user.role });
    const response = NextResponse.json({ id: user.id, email: user.email, role: user.role });
    const cookie = sessionCookie(token);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    logInfo('User logged in', { userId: user.id });

    return response;
  } catch (error) {
    logError('POST /api/auth failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno en login' }, { status: 500 });
  }
}
