import { NextRequest, NextResponse } from 'next/server';
import { authCookieName, SessionUser, verifySessionToken } from '@/lib/auth';

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
