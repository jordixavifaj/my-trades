import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authCookieName, createSessionToken, sessionCookie, verifySessionToken } from '@/lib/auth';

export async function GET() {
  const token = cookies().get(authCookieName)?.value;
  const user = verifySessionToken(token);

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const refreshedToken = createSessionToken(user);
  const response = NextResponse.json({ authenticated: true, user });
  const cookie = sessionCookie(refreshedToken);
  response.cookies.set(cookie.name, cookie.value, cookie.options);

  return response;
}
