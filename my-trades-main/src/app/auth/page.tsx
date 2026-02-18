'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';

type SessionUser = {
  id: string;
  email: string;
  role: 'ADMIN' | 'TRADER';
};

export default function AuthPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [session, setSession] = useState<SessionUser | null>(null);
  const [submitting, setSubmitting] = useState<'login' | 'register' | null>(null);

  async function loadSession() {
    const response = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!response.ok) {
      setSession(null);
      return;
    }

    const result = await response.json();
    setSession(result.user);
  }

  useEffect(() => {
    loadSession();
  }, []);

  async function submit(kind: 'login' | 'register', path: string, formData: FormData) {
    try {
      setSubmitting(kind);
      setMessage('');

      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData.entries())),
      });

      const contentType = response.headers.get('content-type') || '';
      const result = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : null;

      if (!response.ok) {
        const fallbackError = contentType.includes('text/html')
          ? 'Error interno del servidor'
          : 'No se pudo completar la operación';
        setMessage(`Error: ${result?.error ?? fallbackError}`);
        return;
      }

      setMessage(kind === 'register' ? 'Cuenta creada y sesión iniciada correctamente.' : 'Login correcto.');
      await loadSession();
      router.push('/dashboard');
      router.refresh();
    } catch {
      setMessage('Error de red. Intenta de nuevo.');
    } finally {
      setSubmitting(null);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMessage('Sesión cerrada');
    await loadSession();
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-3xl font-bold">Acceso</h1>
      {session && (
        <div className="mb-4 rounded border border-emerald-700 bg-emerald-900/30 p-3 text-sm">
          Sesión activa como <strong>{session.email}</strong> ({session.role})
          <button className="ml-3 rounded bg-slate-700 px-2 py-1" onClick={logout} type="button">Salir</button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <form className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4" onSubmit={(e) => { e.preventDefault(); submit('login', '/api/auth', new FormData(e.currentTarget)); }}>
          <h2 className="text-xl font-semibold">Login</h2>
          <input className="w-full rounded bg-slate-800 p-2" type="email" name="email" placeholder="Email" required />
          <input className="w-full rounded bg-slate-800 p-2" type="password" name="password" placeholder="Password" required />
          <button className="rounded bg-cyan-600 px-3 py-2 disabled:opacity-60" disabled={submitting !== null} type="submit">
            {submitting === 'login' ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <form className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4" onSubmit={(e) => { e.preventDefault(); submit('register', '/api/auth/register', new FormData(e.currentTarget)); }}>
          <h2 className="text-xl font-semibold">Registro</h2>
          <input className="w-full rounded bg-slate-800 p-2" type="text" name="name" placeholder="Nombre" />
          <input className="w-full rounded bg-slate-800 p-2" type="email" name="email" placeholder="Email" required />
          <input className="w-full rounded bg-slate-800 p-2" type="password" name="password" placeholder="Password" required minLength={6} />
          <button className="rounded bg-emerald-600 px-3 py-2 disabled:opacity-60" disabled={submitting !== null} type="submit">
            {submitting === 'register' ? 'Creando...' : 'Crear cuenta'}
          </button>
        </form>
      </div>
      {message && <p className="mt-4 rounded bg-slate-800 p-2 text-sm">{message}</p>}
      <div className="mt-4">
        <a className="inline-block rounded bg-red-600 px-3 py-2 text-sm font-medium" href="/api/auth/google/start">Entrar con Google</a>
      </div>
    </AppShell>
  );
}
