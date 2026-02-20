import { NextRequest, NextResponse } from 'next/server';

type SessionUser = {
  id: string;
  email: string;
  role: 'ADMIN' | 'TRADER' | 'MENTOR' | 'STUDENT';
};

const authCookieName = 'mt_session';
const privatePrefixes = ['/dashboard', '/trades', '/reports', '/community', '/mentor', '/admin', '/api/dashboard', '/api/reports', '/api/upload', '/api/strategies', '/api/trades', '/api/fills', '/api/setups', '/api/community', '/api/mentor', '/api/admin', '/api/users'];

function isPrivatePath(pathname: string) {
  return privatePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function getSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'dev-insecure-secret-change-me';
}

function base64UrlToUint8Array(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
  const base64 = normalized + padding;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function safeCompareString(a: string, b: string) {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

async function sign(value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  const bytes = new Uint8Array(signature);
  let binary = '';

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function verifySessionToken(token?: string | null): Promise<SessionUser | null> {
  if (!token) return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = await sign(encodedPayload);
  if (!safeCompareString(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(encodedPayload))) as SessionUser & { exp: number };

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

    return { id: payload.id, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isPrivatePath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(authCookieName)?.value;
  const user = await verifySessionToken(token);

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const loginUrl = new URL('/auth', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based authorization is handled by each API route using
  // requireRequestUserWithFreshRole() which reads the current role from DB.
  // This ensures admin role changes take effect immediately without re-login.
  // The middleware only verifies authentication (valid session token).

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/trades/:path*', '/reports/:path*', '/community/:path*', '/mentor/:path*', '/admin/:path*', '/api/dashboard/:path*', '/api/reports/:path*', '/api/upload/:path*', '/api/strategies/:path*', '/api/trades/:path*', '/api/fills/:path*', '/api/setups/:path*', '/api/community/:path*', '/api/mentor/:path*', '/api/admin/:path*', '/api/users/:path*'],
};
