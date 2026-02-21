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

  // Change-password flow after admin reset
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

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

      // Check if user must reset password
      if (result?.mustResetPassword) {
        setResetUserId(result.resetToken);
        setMessage('');
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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUserId) return;
    setChangingPassword(true);
    setMessage('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resetUserId, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Error: ${data.error ?? 'No se pudo cambiar la contraseña'}`);
        return;
      }
      setResetUserId(null);
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Contraseña actualizada correctamente.');
      await loadSession();
      router.push('/dashboard');
      router.refresh();
    } catch {
      setMessage('Error de red. Intenta de nuevo.');
    } finally {
      setChangingPassword(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMessage('Sesión cerrada');
    await loadSession();
  }

  // Show change-password form when mustResetPassword is triggered
  if (resetUserId) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md">
          <h1 className="mb-2 text-3xl font-bold">Cambiar contraseña</h1>
          <p className="mb-6 text-sm text-slate-400">
            Tu contraseña fue reseteada por un administrador. Crea una nueva contraseña para continuar.
          </p>

          <form onSubmit={handleChangePassword} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div>
              <label className="mb-1 block text-sm text-slate-400">Nueva contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/70 focus:ring-2"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Confirmar contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/70 focus:ring-2"
                placeholder="Repite la contraseña"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={changingPassword}
              className="w-full rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {changingPassword ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>

          {message && <p className="mt-4 rounded-lg bg-slate-800 p-3 text-sm">{message}</p>}

          <button
            onClick={() => { setResetUserId(null); setMessage(''); }}
            className="mt-4 text-sm text-slate-400 hover:text-slate-200"
          >
            ← Volver al login
          </button>
        </div>
      </AppShell>
    );
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
          <input className="w-full rounded bg-slate-800 p-2 font-mono uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal placeholder:font-sans" type="text" name="inviteCode" placeholder="Código de invitación" required />
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
