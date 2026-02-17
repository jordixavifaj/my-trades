import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authCookieName, verifySessionToken } from '@/lib/auth';

export async function GET() {
  const token = cookies().get(authCookieName)?.value;
  const user = verifySessionToken(token);

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, user });
}
