'use client';

import { AppShell } from '@/components/AppShell';
import { UserDashboardView } from '@/components/UserDashboardView';
import { ReportsDashboardForUser } from '@/components/ReportsDashboardForUser';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function MentorStudentDetailPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const [studentName, setStudentName] = useState<string | null>(null);
  const [tab, setTab] = useState<'dashboard' | 'reports'>('dashboard');

  useEffect(() => {
    fetch('/api/mentor/students', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const student = (data?.students ?? []).find((s: any) => s.id === studentId);
        if (student) setStudentName(student.name ?? student.email);
      })
      .catch(() => {});
  }, [studentId]);

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/mentor" className="text-sm text-cyan-300 hover:text-cyan-200">← Mis Alumnos</Link>
        <span className="text-slate-600">/</span>
        <span className="text-sm text-slate-400">{studentName ?? 'Alumno'}</span>
      </div>

      <section className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          {studentName ?? '…'}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Calendario, trades detallados y reports completos del alumno.
        </p>
      </section>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-slate-900/50 p-1">
        <button
          onClick={() => setTab('dashboard')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'dashboard' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Calendario & Trades
        </button>
        <button
          onClick={() => setTab('reports')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'reports' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Reports
        </button>
      </div>

      {tab === 'dashboard' && <UserDashboardView userId={studentId} showCharts={true} />}
      {tab === 'reports' && <ReportsDashboardForUser userId={studentId} />}
    </AppShell>
  );
}
