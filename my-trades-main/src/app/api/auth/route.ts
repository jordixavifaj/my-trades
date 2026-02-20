import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { execSync } from 'node:child_process';
import { prisma } from '@/lib/prisma';
import { createSessionToken, sessionCookie, toSessionRole, verifyPassword } from '@/lib/auth';

export const runtime = 'nodejs';

type Credentials = { email: string; password: string };

let attemptedAutoSetup = false;

function shouldAutoSetupDatabase() {
  const databaseUrl = process.env.DATABASE_URL || '';
  return process.env.NODE_ENV !== 'production' && databaseUrl.startsWith('file:');
}

function runAutoSetup() {
  if (attemptedAutoSetup || !shouldAutoSetupDatabase()) return false;

  attemptedAutoSetup = true;

  try {
    execSync('npx prisma db push --skip-generate', { stdio: 'ignore' });
    execSync('npm run seed', { stdio: 'ignore' });
    return true;
  } catch (setupError) {
    console.error('Auto setup failed', setupError);
    return false;
  }
}

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
  const body = await readCredentials(request);

  if (!body.email || !body.password) {
    return NextResponse.json({ error: 'Email y password requeridos' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: body.email } });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    if (!user.passwordHash) {
      return NextResponse.json({ error: 'Esta cuenta no tiene password local. Inicia sesión con Google.' }, { status: 401 });
    }

    if (!verifyPassword(body.password, user.passwordHash)) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    // If user must reset password, return a special response instead of a session
    if (user.mustResetPassword) {
      return NextResponse.json({
        mustResetPassword: true,
        resetToken: user.id,
        message: 'Debes cambiar tu contraseña temporal.',
      }, { status: 200 });
    }

    const token = createSessionToken({ id: user.id, email: user.email, role: toSessionRole(user.role) });
    const response = NextResponse.json({ id: user.id, email: user.email, role: toSessionRole(user.role) });
    const cookie = sessionCookie(token);
    response.cookies.set(cookie.name, cookie.value, cookie.options);

    return response;
  } catch (error) {
    console.error('POST /api/auth failed', error);

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        { error: 'Configuración de base de datos inválida. Revisa DATABASE_URL en el archivo .env.' },
        { status: 500 },
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      if (runAutoSetup()) {
        try {
          const user = await prisma.user.findUnique({ where: { email: body.email } });

          if (!user || !user.isActive || !user.passwordHash || !verifyPassword(body.password, user.passwordHash)) {
            return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
          }

          const token = createSessionToken({ id: user.id, email: user.email, role: toSessionRole(user.role) });
          const response = NextResponse.json({ id: user.id, email: user.email, role: toSessionRole(user.role) });
          const cookie = sessionCookie(token);
          response.cookies.set(cookie.name, cookie.value, cookie.options);
          return response;
        } catch (retryError) {
          console.error('POST /api/auth retry after auto setup failed', retryError);
        }
      }

      return NextResponse.json(
        { error: 'Base de datos no inicializada. Ejecuta: npx prisma db push && npm run seed' },
        { status: 500 },
      );
    }

    return NextResponse.json({ error: 'Error interno en login' }, { status: 500 });
  }
}
