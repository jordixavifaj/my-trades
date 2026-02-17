import { createHmac, timingSafeEqual } from 'crypto';

export type SessionUser = {
  id: string;
  email: string;
  role: 'ADMIN' | 'TRADER';
};

const COOKIE_NAME = 'mt_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function getSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'dev-insecure-secret-change-me';
}

function sign(value: string) {
  return createHmac('sha256', getSecret()).update(value).digest('base64url');
}

export function createSessionToken(user: SessionUser) {
  const payload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token?: string | null): SessionUser | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  const isValidSignature =
    Buffer.byteLength(signature) === Buffer.byteLength(expectedSignature) &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  if (!isValidSignature) return null;

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionUser & { exp: number };

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

  return { id: payload.id, email: payload.email, role: payload.role };
}

export function sessionCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    },
  };
}

export function clearSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: '',
    options: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    },
  };
}

export const authCookieName = COOKIE_NAME;
