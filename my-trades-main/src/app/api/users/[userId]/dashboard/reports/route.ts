import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUserWithFreshRole } from '@/lib/request-auth';
import { canViewUser } from '@/lib/access-control';
import { generateReportsForUser } from '@/app/api/dashboard/reports/route';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  const { userId } = params;

  const access = await canViewUser(auth.id, auth.role, userId);
  if (!access) {
    return NextResponse.json({ error: 'No tienes acceso a este usuario' }, { status: 403 });
  }

  // Reports are only accessible by mentor or admin level access
  if (access === 'community') {
    return NextResponse.json({ error: 'No tienes acceso a los reports de este usuario' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const data = await generateReportsForUser(userId, searchParams);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/users/[userId]/dashboard/reports failed', error);
    return NextResponse.json({ error: 'Error al obtener reports' }, { status: 500 });
  }
}
