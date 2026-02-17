import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSessionToken, detectPasswordHashScheme, sessionCookie, verifyPassword } from '@/lib/auth';

export const runtime = 'nodejs';

type Credentials = { email: string; password: string };

async function readCredentials(request: NextRequest): Promise<Credentials> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null);
    return {
      email: typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '',
      password: typeof body?.password === 'string' ? body.password : '',
    };
  }

  if (
    contentType.includes('application/x-www-form-urlencoded')
    || contentType.includes('multipart/form-data')
  ) {
    const formData = await request.formData();
    return {
      email: typeof formData.get('email') === 'string' ? String(formData.get('email')).trim().toLowerCase() : '',
      password: typeof formData.get('password') === 'string' ? String(formData.get('password')) : '',
    };
  }

  const body = await request.json().catch(() => null);
  return {
    email: typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '',
    password: typeof body?.password === 'string' ? body.password : '',
  };
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await readCredentials(request);

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y password requeridos' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const hashScheme = detectPasswordHashScheme(user.passwordHash);

    if (hashScheme === 'missing') {
      return NextResponse.json({ error: 'Esta cuenta no tiene password local. Inicia sesión con Google.' }, { status: 401 });
    }

    if (hashScheme === 'bcrypt') {
      return NextResponse.json({ error: 'Tu cuenta usa un formato de contraseña antiguo no compatible. Restablece tu contraseña o crea una nueva cuenta.' }, { status: 401 });
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const token = createSessionToken({ id: user.id, email: user.email, role: user.role });
    const response = NextResponse.json({ id: user.id, email: user.email, role: user.role });
    const cookie = sessionCookie(token);
    response.cookies.set(cookie.name, cookie.value, cookie.options);

    return response;
  } catch (error) {
    console.error('POST /api/auth failed', error);
    return NextResponse.json({ error: 'Error interno en login' }, { status: 500 });
  }
}
