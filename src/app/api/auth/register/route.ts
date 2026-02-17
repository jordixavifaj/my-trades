import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createSessionToken, hashPassword, sessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

type RegistrationPayload = { email: string; password: string; name: string | null };

async function readRegistrationPayload(request: NextRequest): Promise<RegistrationPayload> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null);
    return {
      email: typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '',
      password: typeof body?.password === 'string' ? body.password : '',
      name: typeof body?.name === 'string' ? body.name.trim() : null,
    };
  }

  if (
    contentType.includes('application/x-www-form-urlencoded')
    || contentType.includes('multipart/form-data')
  ) {
    const formData = await request.formData();
    const rawName = formData.get('name');
    return {
      email: typeof formData.get('email') === 'string' ? String(formData.get('email')).trim().toLowerCase() : '',
      password: typeof formData.get('password') === 'string' ? String(formData.get('password')) : '',
      name: typeof rawName === 'string' ? rawName.trim() : null,
    };
  }

  const body = await request.json().catch(() => null);
  return {
    email: typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '',
    password: typeof body?.password === 'string' ? body.password : '',
    name: typeof body?.name === 'string' ? body.name.trim() : null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await readRegistrationPayload(request);

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y password son obligatorios' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'El password debe tener al menos 6 caracteres' }, { status: 400 });
    }

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

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 409 });
    }

    console.error('POST /api/auth/register failed', error);
    return NextResponse.json({ error: 'Error interno al registrar usuario' }, { status: 500 });
  }
}
