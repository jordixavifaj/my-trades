import { NextResponse } from 'next/server';
import { getDashboardMetrics } from '@/lib/metrics';
import { requireRequestUser } from '@/lib/request-auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const auth = requireRequestUser(request);
    if (auth instanceof NextResponse) return auth;

    const data = await getDashboardMetrics(auth.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudo cargar dashboard' }, { status: 500 });
  }
}
