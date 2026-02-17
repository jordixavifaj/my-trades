import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSessionToken, sessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y password requeridos' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const hash = createHash('sha256').update(password).digest('hex');

  if (!user || user.passwordHash !== hash || !user.isActive) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  }

  const token = createSessionToken({ id: user.id, email: user.email, role: user.role });
  const response = NextResponse.json({ id: user.id, email: user.email, role: user.role });
  const cookie = sessionCookie(token);
  response.cookies.set(cookie.name, cookie.value, cookie.options);

  return response;
}
