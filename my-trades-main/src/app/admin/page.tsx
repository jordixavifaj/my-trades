'use client';

import { AppShell } from '@/components/AppShell';
import { useCallback, useEffect, useState } from 'react';

type UserItem = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { trades: number };
};

type CommunityItem = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count: { members: number };
};

type AssignmentItem = {
  id: string;
  mentor: { id: string; name: string | null; email: string };
  student: { id: string; name: string | null; email: string };
};

const ROLES = ['ADMIN', 'TRADER', 'MENTOR', 'STUDENT'] as const;

export default function AdminPage() {
  const [tab, setTab] = useState<'users' | 'communities' | 'assignments'>('users');

  // Users
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Communities
  const [communities, setCommunities] = useState<CommunityItem[]>([]);
  const [commLoading, setCommLoading] = useState(false);
  const [newCommName, setNewCommName] = useState('');
  const [addMemberCommunity, setAddMemberCommunity] = useState('');
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [expandedComm, setExpandedComm] = useState<string | null>(null);
  const [commMembers, setCommMembers] = useState<Record<string, Array<{ userId: string; user: { id: string; name: string | null; email: string; role: string } }>>>({});
  const [commMemberSearch, setCommMemberSearch] = useState('');

  // Assignments
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [newMentorEmail, setNewMentorEmail] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');

  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null);

  const showMsg = (text: string, ok: boolean) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const p = new URLSearchParams();
      if (roleFilter) p.set('role', roleFilter);
      if (searchFilter) p.set('search', searchFilter);
      const res = await fetch(`/api/admin/users?${p}`, { cache: 'no-store' });
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch { setUsers([]); }
    finally { setUsersLoading(false); }
  }, [roleFilter, searchFilter]);

  // Fetch Communities
  const fetchCommunities = useCallback(async () => {
    setCommLoading(true);
    try {
      const res = await fetch('/api/admin/communities', { cache: 'no-store' });
      const data = await res.json();
      setCommunities(data.communities ?? []);
    } catch { setCommunities([]); }
    finally { setCommLoading(false); }
  }, []);

  // Fetch Assignments
  const fetchAssignments = useCallback(async () => {
    setAssignLoading(true);
    try {
      const res = await fetch('/api/admin/assignments', { cache: 'no-store' });
      const data = await res.json();
      setAssignments(data.assignments ?? []);
    } catch { setAssignments([]); }
    finally { setAssignLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { if (tab === 'communities') fetchCommunities(); }, [tab, fetchCommunities]);
  useEffect(() => { if (tab === 'assignments') fetchAssignments(); }, [tab, fetchAssignments]);

  // Change Role
  const changeRole = async (userId: string, role: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      const data = await res.json();
      if (!res.ok) { showMsg(data.error ?? 'Error', false); return; }
      showMsg(`Rol actualizado a ${role}`, true);
      fetchUsers();
    } catch { showMsg('Error de red', false); }
  };

  // Reset Password
  const resetPassword = async (userId: string, email: string) => {
    if (!confirm(`¿Resetear la contraseña de ${email}?`)) return;
    try {
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) { showMsg(data.error ?? 'Error', false); return; }
      setResetResult({ email, tempPassword: data.tempPassword });
      showMsg(`Contraseña de ${email} reseteada`, true);
    } catch { showMsg('Error de red', false); }
  };

  // Fetch community members
  const fetchCommMembers = async (communityId: string) => {
    try {
      const res = await fetch(`/api/admin/communities/members?communityId=${communityId}`, { cache: 'no-store' });
      const data = await res.json();
      setCommMembers((prev) => ({ ...prev, [communityId]: data.members ?? [] }));
    } catch { /* ignore */ }
  };

  // Toggle expanded community
  const toggleComm = (communityId: string) => {
    if (expandedComm === communityId) {
      setExpandedComm(null);
    } else {
      setExpandedComm(communityId);
      setCommMemberSearch('');
      fetchCommMembers(communityId);
    }
  };

  // Remove member from community
  const removeMember = async (communityId: string, userId: string, email: string) => {
    if (!confirm(`¿Eliminar a ${email} de la comunidad?`)) return;
    try {
      const res = await fetch(`/api/admin/communities/members?communityId=${communityId}&userId=${userId}`, { method: 'DELETE' });
      if (!res.ok) { showMsg('Error al eliminar miembro', false); return; }
      showMsg(`${email} eliminado de la comunidad`, true);
      fetchCommMembers(communityId);
      fetchCommunities();
    } catch { showMsg('Error de red', false); }
  };

  // Create Community
  const createCommunity = async () => {
    if (!newCommName.trim()) return;
    try {
      const res = await fetch('/api/admin/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCommName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { showMsg(data.error ?? 'Error', false); return; }
      showMsg(`Comunidad "${newCommName}" creada`, true);
      setNewCommName('');
      fetchCommunities();
    } catch { showMsg('Error de red', false); }
  };

  // Add member to community
  const addMember = async () => {
    if (!addMemberCommunity || !addMemberEmail.trim()) return;
    const user = users.find((u) => u.email === addMemberEmail.trim().toLowerCase());
    if (!user) { showMsg('Usuario no encontrado. Búscalo primero en la pestaña Usuarios.', false); return; }
    try {
      const res = await fetch('/api/admin/communities/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ communityId: addMemberCommunity, userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) { showMsg(data.error ?? 'Error', false); return; }
      showMsg(`${user.email} añadido a la comunidad`, true);
      setAddMemberEmail('');
      fetchCommunities();
    } catch { showMsg('Error de red', false); }
  };

  // Create Assignment
  const createAssignment = async () => {
    if (!newMentorEmail.trim() || !newStudentEmail.trim()) return;
    const mentor = users.find((u) => u.email === newMentorEmail.trim().toLowerCase());
    const student = users.find((u) => u.email === newStudentEmail.trim().toLowerCase());
    if (!mentor) { showMsg('Mentor no encontrado', false); return; }
    if (!student) { showMsg('Alumno no encontrado', false); return; }
    try {
      const res = await fetch('/api/admin/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mentorId: mentor.id, studentId: student.id }),
      });
      const data = await res.json();
      if (!res.ok) { showMsg(data.error ?? 'Error', false); return; }
      showMsg('Asignación creada', true);
      setNewMentorEmail('');
      setNewStudentEmail('');
      fetchAssignments();
    } catch { showMsg('Error de red', false); }
  };

  // Delete Assignment
  const deleteAssignment = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/assignments?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { showMsg('Error al eliminar', false); return; }
      showMsg('Asignación eliminada', true);
      fetchAssignments();
    } catch { showMsg('Error de red', false); }
  };

  return (
    <AppShell>
      <section className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Administración</h1>
        <p className="mt-1 text-sm text-slate-400">Gestión de usuarios, comunidades y asignaciones mentor-alumno.</p>
      </section>

      {msg && (
        <div className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${msg.ok ? 'border-emerald-700 bg-emerald-950/30 text-emerald-300' : 'border-rose-700 bg-rose-950/30 text-rose-300'}`}>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-slate-900/50 p-1">
        {(['users', 'communities', 'assignments'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {t === 'users' ? 'Usuarios' : t === 'communities' ? 'Comunidades' : 'Asignaciones'}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === 'users' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              placeholder="Buscar email o nombre…"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/70 focus:ring-2"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Todos los roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <span className="text-xs text-slate-400">{users.length} usuarios</span>
          </div>

          {usersLoading && <p className="text-sm text-slate-400">Cargando…</p>}

          {!usersLoading && (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-left text-xs text-slate-400">
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Trades</th>
                    <th className="px-4 py-3">Cambiar Rol</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                      <td className="px-4 py-2.5 font-medium text-slate-200">{u.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-400">{u.email}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">{u.role}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">{u._count.trades}</td>
                      <td className="px-4 py-2.5">
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u.id, e.target.value)}
                          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => resetPassword(u.id, u.email)}
                          className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/20"
                        >
                          Reset Password
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Reset password result modal */}
          {resetResult && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-slate-100">Contraseña reseteada</h3>
                <p className="mt-2 text-sm text-slate-400">Usuario: <span className="text-slate-200">{resetResult.email}</span></p>
                <p className="mt-1 text-sm text-slate-400">Nueva contraseña temporal:</p>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3">
                  <code className="flex-1 text-lg font-bold tracking-widest text-amber-300">{resetResult.tempPassword}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(resetResult.tempPassword); showMsg('Copiado al portapapeles', true); }}
                    className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Copiar
                  </button>
                </div>
                <p className="mt-3 text-xs text-amber-400/80">Comparte esta contraseña con el usuario. Debera cambiarla despues de iniciar sesion.</p>
                <button
                  onClick={() => setResetResult(null)}
                  className="mt-4 w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Communities Tab */}
      {tab === 'communities' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              placeholder="Nombre nueva comunidad"
              value={newCommName}
              onChange={(e) => setNewCommName(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/70 focus:ring-2"
            />
            <button onClick={createCommunity} className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20">
              Crear Comunidad
            </button>
          </div>

          {commLoading && <p className="text-sm text-slate-400">Cargando…</p>}

          {!commLoading && communities.length === 0 && (
            <p className="text-sm text-slate-400">No hay comunidades. Crea la primera.</p>
          )}

          {!commLoading && communities.length > 0 && (
            <div className="mb-6 space-y-3">
              {communities.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-950/40">
                  <button
                    onClick={() => toggleComm(c.id)}
                    className="flex w-full items-center justify-between p-4 text-left"
                  >
                    <div>
                      <h3 className="font-semibold text-slate-100">{c.name}</h3>
                      {c.description && <p className="mt-0.5 text-xs text-slate-400">{c.description}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-400">{c._count.members} miembros</span>
                      <svg className={`h-4 w-4 text-slate-500 transition ${expandedComm === c.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {expandedComm === c.id && (
                    <div className="border-t border-slate-800 px-4 pb-4 pt-3">
                      {commMembers[c.id]?.length > 0 && (
                        <input
                          placeholder="Buscar miembro…"
                          value={commMemberSearch}
                          onChange={(e) => setCommMemberSearch(e.target.value)}
                          className="mb-3 w-full max-w-sm rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/70 transition placeholder:text-slate-500 focus:ring-2"
                        />
                      )}
                      {!(commMembers[c.id]?.length) && <p className="text-xs text-slate-500">No hay miembros.</p>}
                      {commMembers[c.id]?.length > 0 && (() => {
                        const q = commMemberSearch.trim().toLowerCase();
                        const filtered = q
                          ? commMembers[c.id].filter((m) => (m.user.name ?? '').toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q))
                          : commMembers[c.id];
                        return (
                          <div className="space-y-1">
                            {filtered.length === 0 && <p className="text-xs text-slate-500">No se encontraron miembros con &quot;{commMemberSearch}&quot;</p>}
                            {filtered.map((m) => (
                              <div key={m.userId} className="flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-2">
                                <div className="min-w-0 flex-1">
                                  <span className="text-sm font-medium text-slate-200">{m.user.name ?? m.user.email}</span>
                                  <span className="ml-2 text-xs text-slate-500">{m.user.email}</span>
                                  <span className="ml-2 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{m.user.role}</span>
                                </div>
                                <button
                                  onClick={() => removeMember(c.id, m.userId, m.user.email)}
                                  className="ml-3 shrink-0 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/20"
                                >
                                  Eliminar
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {communities.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <h4 className="mb-3 text-sm font-semibold text-slate-200">Añadir miembro a comunidad</h4>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={addMemberCommunity}
                  onChange={(e) => setAddMemberCommunity(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">Seleccionar comunidad</option>
                  {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input
                  placeholder="Email del usuario"
                  value={addMemberEmail}
                  onChange={(e) => setAddMemberEmail(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/70 focus:ring-2"
                />
                <button onClick={addMember} className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20">
                  Añadir
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assignments Tab */}
      {tab === 'assignments' && (
        <div>
          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-200">Nueva asignación Mentor → Alumno</h4>
            <div className="flex flex-wrap items-center gap-3">
              <input
                placeholder="Email del mentor"
                value={newMentorEmail}
                onChange={(e) => setNewMentorEmail(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/70 focus:ring-2"
              />
              <span className="text-slate-500">→</span>
              <input
                placeholder="Email del alumno"
                value={newStudentEmail}
                onChange={(e) => setNewStudentEmail(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/70 focus:ring-2"
              />
              <button onClick={createAssignment} className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20">
                Asignar
              </button>
            </div>
          </div>

          {assignLoading && <p className="text-sm text-slate-400">Cargando…</p>}

          {!assignLoading && assignments.length === 0 && (
            <p className="text-sm text-slate-400">No hay asignaciones. Crea la primera.</p>
          )}

          {!assignLoading && assignments.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-left text-xs text-slate-400">
                    <th className="px-4 py-3">Mentor</th>
                    <th className="px-4 py-3">Alumno</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-slate-200">{a.mentor.name ?? a.mentor.email}</span>
                        <span className="ml-2 text-xs text-slate-500">{a.mentor.email}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-slate-200">{a.student.name ?? a.student.email}</span>
                        <span className="ml-2 text-xs text-slate-500">{a.student.email}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => deleteAssignment(a.id)}
                          className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/20"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
