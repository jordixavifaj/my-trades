import { NextRequest, NextResponse } from 'next/server';
import { authCookieName, verifySessionToken } from '@/lib/auth';

const privatePrefixes = ['/dashboard', '/trades', '/reports', '/api/dashboard', '/api/reports', '/api/upload', '/api/strategies'];

function isPrivatePath(pathname: string) {
  return privatePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isPrivatePath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(authCookieName)?.value;
  const user = verifySessionToken(token);

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const loginUrl = new URL('/auth', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/api/strategies') && request.method !== 'GET' && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/trades/:path*', '/reports/:path*', '/api/dashboard/:path*', '/api/reports/:path*', '/api/upload/:path*', '/api/strategies/:path*'],
};
