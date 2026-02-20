'use client';

import { AppShell } from '@/components/AppShell';
import { UserDashboardView } from '@/components/UserDashboardView';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function CommunityProfilePage() {
  const params = useParams();
  const userId = params.userId as string;
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/users/${userId}/dashboard`, { cache: 'no-store' })
      .then(() => {})
      .catch(() => {});
    // Fetch user name from community members
    fetch('/api/community/members', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const member = (data?.members ?? []).find((m: any) => m.user?.id === userId);
        if (member) setUserName(member.user.name ?? member.user.email);
      })
      .catch(() => {});
  }, [userId]);

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/community" className="text-sm text-cyan-300 hover:text-cyan-200">← Comunidad</Link>
        <span className="text-slate-600">/</span>
        <span className="text-sm text-slate-400">{userName ?? 'Miembro'}</span>
      </div>

      <section className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Perfil de {userName ?? '…'}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Calendario de trading, tickers operados y detalle de ejecuciones.
        </p>
      </section>

      <UserDashboardView userId={userId} showCharts={true} />
    </AppShell>
  );
}
