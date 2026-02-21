import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createSessionToken, hashPassword, sessionCookie, toSessionRole } from '@/lib/auth';

export const runtime = 'nodejs';

type RegistrationPayload = { email: string; password: string; name: string | null; inviteCode: string };

const ALLOWED_EMAIL_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || '').split(',').map(d => d.trim().toLowerCase()).filter(Boolean);

async function readRegistrationPayload(request: NextRequest): Promise<RegistrationPayload> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null);
    return {
      email: typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '',
      password: typeof body?.password === 'string' ? body.password : '',
      name: typeof body?.name === 'string' ? body.name.trim() : null,
      inviteCode: typeof body?.inviteCode === 'string' ? body.inviteCode.trim().toUpperCase() : '',
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
      inviteCode: typeof formData.get('inviteCode') === 'string' ? String(formData.get('inviteCode')).trim().toUpperCase() : '',
    };
  }

  const body = await request.json().catch(() => null);
  return {
    email: typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '',
    password: typeof body?.password === 'string' ? body.password : '',
    name: typeof body?.name === 'string' ? body.name.trim() : null,
    inviteCode: typeof body?.inviteCode === 'string' ? body.inviteCode.trim().toUpperCase() : '',
  };
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, inviteCode } = await readRegistrationPayload(request);

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y password son obligatorios' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'El password debe tener al menos 6 caracteres' }, { status: 400 });
    }

    // Validate email domain if restrictions are configured
    if (ALLOWED_EMAIL_DOMAINS.length > 0) {
      const emailDomain = email.split('@')[1];
      if (!emailDomain || !ALLOWED_EMAIL_DOMAINS.includes(emailDomain)) {
        return NextResponse.json({ error: 'Solo se permiten emails de la academia.' }, { status: 400 });
      }
    }

    // Validate invite code
    if (!inviteCode) {
      return NextResponse.json({ error: 'El código de invitación es obligatorio.' }, { status: 400 });
    }

    const invite = await prisma.inviteCode.findUnique({ where: { code: inviteCode } });

    if (!invite || invite.used) {
      return NextResponse.json({ error: 'Código inválido o ya utilizado, contacta con la academia.' }, { status: 400 });
    }

    if (invite.assignedEmail && invite.assignedEmail !== email) {
      return NextResponse.json({ error: 'Este código está asignado a otro email. Contacta con la academia.' }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 409 });
    }

    // Create user and mark code as used in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          name,
          passwordHash: hashPassword(password),
          role: 'STUDENT',
          isActive: true,
        },
      });

      await tx.inviteCode.update({
        where: { id: invite.id },
        data: {
          used: true,
          usedByUserId: newUser.id,
          usedByEmail: email,
          usedAt: new Date(),
        },
      });

      return newUser;
    });

    const token = createSessionToken({ id: user.id, email: user.email, role: toSessionRole(user.role) });
    const response = NextResponse.json({ id: user.id, email: user.email, role: toSessionRole(user.role) }, { status: 201 });
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
