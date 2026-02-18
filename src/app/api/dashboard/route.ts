import { NextResponse } from 'next/server';
import { getDashboardMetrics } from '@/lib/metrics';

export async function GET() {
  try {
    const data = await getDashboardMetrics();
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudo cargar dashboard' }, { status: 500 });
  }
}
