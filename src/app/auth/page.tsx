'use client';

import { useState } from 'react';
import { AppShell } from '@/components/AppShell';

export default function AuthPage() {
  const [message, setMessage] = useState('');

  async function submit(path: string, formData: FormData) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const result = await response.json();
    setMessage(response.ok ? `OK: ${JSON.stringify(result)}` : `Error: ${result.error}`);
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-3xl font-bold">Acceso</h1>
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
    </AppShell>
  );
}
