import { createHash, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

export type SessionUser = {
  id: string;
  email: string;
  role: 'ADMIN' | 'TRADER';
};

const COOKIE_NAME = 'mt_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEYLEN = 64;
const PASSWORD_DIGEST = 'sha512';


export type PasswordHashScheme = 'missing' | 'pbkdf2' | 'sha256' | 'bcrypt' | 'unknown';

export function detectPasswordHashScheme(storedHash: string | null | undefined): PasswordHashScheme {
  if (!storedHash) return 'missing';
  if (storedHash.startsWith('pbkdf2$')) return 'pbkdf2';
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) return 'bcrypt';
  if (/^[a-f0-9]{64}$/i.test(storedHash)) return 'sha256';
  return 'unknown';
}

function getSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'dev-insecure-secret-change-me';
}

function sign(value: string) {
  return createHmac('sha256', getSecret()).update(value).digest('base64url');
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEYLEN, PASSWORD_DIGEST).toString('hex');
  return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined) {
  const scheme = detectPasswordHashScheme(storedHash);

  if (scheme === 'missing' || scheme === 'unknown' || scheme === 'bcrypt') return false;

  if (scheme === 'pbkdf2') {
    const [, iterationsRaw, salt, expected] = String(storedHash).split('$');
    const iterations = Number.parseInt(iterationsRaw, 10);
    if (!iterations || !salt || !expected) return false;

    const current = pbkdf2Sync(password, salt, iterations, PASSWORD_KEYLEN, PASSWORD_DIGEST).toString('hex');
    return safeCompare(current, expected);
  }

  const legacy = createHash('sha256').update(password).digest('hex');
  return safeCompare(legacy, String(storedHash));
}

function safeCompare(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function createSessionToken(user: SessionUser) {
  const payload = {
    ...user,
    iat: Math.floor(Date.now() / 1000),
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
  const isValidSignature = safeCompare(signature, expectedSignature);

  if (!isValidSignature) return null;

  let payload: (SessionUser & { exp: number }) | null = null;

  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionUser & { exp: number };
  } catch {
    return null;
  }

  if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

  return { id: payload.id, email: payload.email, role: payload.role };
}

export function sessionCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      sameSite: 'strict' as const,
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
      sameSite: 'strict' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    },
  };
}

export const authCookieName = COOKIE_NAME;
