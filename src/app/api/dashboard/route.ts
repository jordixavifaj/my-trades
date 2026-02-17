import { NextRequest, NextResponse } from 'next/server';
import { getDashboardMetrics } from '@/lib/metrics';
import { requireRequestUser } from '@/lib/request-auth';
import { logError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const auth = requireRequestUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const data = await getDashboardMetrics(auth.id);
    return NextResponse.json(data);
  } catch (error) {
    logError('GET /api/dashboard failed', error, { userId: auth.id });
    return NextResponse.json({ error: 'No se pudo cargar dashboard' }, { status: 500 });
  }
}
