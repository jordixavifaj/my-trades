'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';

type SessionUser = {
  id: string;
  email: string;
  role: 'ADMIN' | 'TRADER';
};

export default function AuthPage() {
  const [message, setMessage] = useState('');
  const [session, setSession] = useState<SessionUser | null>(null);

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

  async function submit(path: string, formData: FormData) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const result = await response.json();
    setMessage(response.ok ? `OK: ${JSON.stringify(result)}` : `Error: ${result.error}`);
    await loadSession();
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
        <form className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4" onSubmit={(e) => { e.preventDefault(); submit('/api/auth', new FormData(e.currentTarget)); }}>
          <h2 className="text-xl font-semibold">Login</h2>
          <input className="w-full rounded bg-slate-800 p-2" type="email" name="email" placeholder="Email" />
          <input className="w-full rounded bg-slate-800 p-2" type="password" name="password" placeholder="Password" />
          <button className="rounded bg-cyan-600 px-3 py-2" type="submit">Entrar</button>
        </form>
        <form className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4" onSubmit={(e) => { e.preventDefault(); submit('/api/auth/register', new FormData(e.currentTarget)); }}>
          <h2 className="text-xl font-semibold">Registro</h2>
          <input className="w-full rounded bg-slate-800 p-2" type="text" name="name" placeholder="Nombre" />
          <input className="w-full rounded bg-slate-800 p-2" type="email" name="email" placeholder="Email" />
          <input className="w-full rounded bg-slate-800 p-2" type="password" name="password" placeholder="Password" />
          <button className="rounded bg-emerald-600 px-3 py-2" type="submit">Crear cuenta</button>
        </form>
      </div>
      {message && <p className="mt-4 rounded bg-slate-800 p-2 text-sm">{message}</p>}
      <p className="mt-4 text-xs text-slate-400">Google OAuth y NextAuth quedan pendientes por restricción de instalación de dependencias en este entorno.</p>
    </AppShell>
  );
}
