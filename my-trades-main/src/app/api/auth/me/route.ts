import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authCookieName, verifySessionToken, toSessionRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const token = cookies().get(authCookieName)?.value;
  const sessionUser = verifySessionToken(token);

  if (!sessionUser) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Always read the current role from DB so role changes take effect immediately
  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!dbUser) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: toSessionRole(dbUser.role),
  };

  return NextResponse.json({ authenticated: true, user });
}
