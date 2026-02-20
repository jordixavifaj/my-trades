import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUserWithFreshRole } from '@/lib/request-auth';
import { canViewUser } from '@/lib/access-control';
import { getDashboardMetrics } from '@/lib/metrics';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  const { userId } = params;

  const access = await canViewUser(auth.id, auth.role, userId);
  if (!access) {
    return NextResponse.json({ error: 'No tienes acceso a este usuario' }, { status: 403 });
  }

  try {
    const data = await getDashboardMetrics(userId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/users/[userId]/dashboard failed', error);
    return NextResponse.json({ error: 'Error al obtener dashboard' }, { status: 500 });
  }
}
