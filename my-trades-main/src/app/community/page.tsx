'use client';

import { AppShell } from '@/components/AppShell';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Member = {
  userId: string;
  communityId: string;
  user: { id: string; name: string | null; email: string; role: string };
  community: { id: string; name: string };
};

type CommunityInfo = { id: string; name: string };

export default function CommunityPage() {
  const [communities, setCommunities] = useState<CommunityInfo[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/community/members', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCommunities(data.communities ?? []);
      setMembers(data.members ?? []);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // De-duplicate members by userId (they might appear in multiple communities)
  const uniqueMembers = Array.from(
    new Map(members.map((m) => [m.user.id, m])).values(),
  );

  const q = search.trim().toLowerCase();
  const filtered = q
    ? uniqueMembers.filter((m) => (m.user.name ?? '').toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q))
    : uniqueMembers;

  return (
    <AppShell>
      <section className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Comunidad</h1>
        <p className="mt-1 text-sm text-slate-400">
          Miembros de tu comunidad. Haz clic en un usuario para ver su calendario y trades.
        </p>
        {communities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {communities.map((c) => (
              <span key={c.id} className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-300">
                {c.name}
              </span>
            ))}
          </div>
        )}
      </section>

      {!loading && uniqueMembers.length > 0 && (
        <div className="mb-4">
          <input
            placeholder="Buscar miembro…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/70 transition placeholder:text-slate-500 focus:ring-2"
          />
        </div>
      )}

      {loading && <p className="text-sm text-slate-400">Cargando…</p>}

      {!loading && uniqueMembers.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-8 text-center">
          <p className="text-slate-400">No perteneces a ninguna comunidad.</p>
          <p className="mt-1 text-xs text-slate-500">Un administrador puede añadirte a una comunidad.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <Link
              key={m.user.id}
              href={`/community/${m.user.id}`}
              className="group flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-cyan-500/40 hover:bg-slate-900/60"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-bold text-cyan-300">
                {(m.user.name ?? m.user.email).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-100 group-hover:text-cyan-200">
                  {m.user.name ?? m.user.email}
                </p>
              </div>
              <svg className="h-4 w-4 text-slate-600 transition group-hover:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      )}

      {!loading && uniqueMembers.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-slate-400">No se encontraron miembros con {'"'}{search}{'"'}</p>
      )}
    </AppShell>
  );
}
