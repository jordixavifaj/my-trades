import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUserWithFreshRole } from '@/lib/request-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== 'MENTOR' && auth.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo mentores' }, { status: 403 });
  }

  const { studentId } = params;

  try {
    // Verify this mentor is assigned to this student
    const assignment = await prisma.mentorAssignment.findFirst({
      where: { mentorId: auth.id, studentId },
    });

    if (!assignment && auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No tienes acceso a los reports de este alumno' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: Record<string, unknown> = { userId: studentId };
    if (from || to) {
      where.openDate = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const [trades, student] = await Promise.all([
      prisma.trade.findMany({
        where,
        include: { strategy: true },
        orderBy: { openDate: 'desc' },
      }),
      prisma.user.findUnique({
        where: { id: studentId },
        select: { id: true, name: true, email: true },
      }),
    ]);

    const totalPnl = trades.reduce((sum, t) => sum + ((t.pnl ?? 0) - t.commission), 0);
    const winners = trades.filter((t) => (t.pnl ?? 0) - t.commission > 0).length;
    const losers = trades.filter((t) => (t.pnl ?? 0) - t.commission < 0).length;

    const byStrategy = Object.values(
      trades.reduce<Record<string, { strategy: string; trades: number; pnl: number }>>((acc, trade) => {
        const key = trade.strategy?.name ?? 'Sin estrategia';
        if (!acc[key]) acc[key] = { strategy: key, trades: 0, pnl: 0 };
        acc[key].trades += 1;
        acc[key].pnl += (trade.pnl ?? 0) - trade.commission;
        return acc;
      }, {}),
    );

    return NextResponse.json({
      student,
      totalTrades: trades.length,
      totalPnl,
      winners,
      losers,
      winRate: trades.length > 0 ? ((winners / trades.length) * 100).toFixed(1) : '0',
      byStrategy,
      trades,
    });
  } catch (error) {
    console.error('GET /api/mentor/students/[id]/reports failed', error);
    return NextResponse.json({ error: 'Error al obtener reports del alumno' }, { status: 500 });
  }
}
