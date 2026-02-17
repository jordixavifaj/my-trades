import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSessionToken, hashPassword, sessionCookie } from '@/lib/auth';
import { logError, logInfo } from '@/lib/logger';
import { parseString } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = parseString(body?.email, 'email', { minLength: 5, maxLength: 255 }).toLowerCase();
    const password = parseString(body?.password, 'password', { minLength: 8, maxLength: 128 });
    const name = body?.name ? parseString(body.name, 'name', { minLength: 2, maxLength: 100 }) : null;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: hashPassword(password),
        role: 'TRADER',
        isActive: true,
      },
    });

    const token = createSessionToken({ id: user.id, email: user.email, role: user.role });
    const response = NextResponse.json({ id: user.id, email: user.email, role: user.role }, { status: 201 });
    const cookie = sessionCookie(token);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    logInfo('User registered', { userId: user.id });

    return response;
  } catch (error) {
    logError('POST /api/auth/register failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno al registrar usuario' },
      { status: 500 },
    );
  }
}
