import { NextRequest, NextResponse } from 'next/server';
import { authCookieName, SessionUser, verifySessionToken, toSessionRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export function getRequestUser(request: NextRequest): SessionUser | null {
  return verifySessionToken(request.cookies.get(authCookieName)?.value);
}

export function requireRequestUser(request: NextRequest): SessionUser | NextResponse {
  const user = getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  return user;
}

/**
 * Like requireRequestUser but reads the current role from the database
 * so that admin role changes take effect immediately without re-login.
 */
export async function requireRequestUserWithFreshRole(request: NextRequest): Promise<SessionUser | NextResponse> {
  const jwtUser = getRequestUser(request);
  if (!jwtUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: jwtUser.id },
    select: { role: true },
  });

  if (!dbUser) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 401 });
  }

  return { ...jwtUser, role: toSessionRole(dbUser.role) };
}
