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
      return NextResponse.json({ error: 'No tienes acceso a este alumno' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? '20', 10)));
    const symbol = searchParams.get('symbol') ?? undefined;

    const where: Record<string, unknown> = { userId: studentId };
    if (symbol) {
      where.symbol = { contains: symbol, mode: 'insensitive' };
    }

    const [items, total, student] = await Promise.all([
      prisma.trade.findMany({
        where,
        include: { strategy: true, fills: true },
        orderBy: { openDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.trade.count({ where }),
      prisma.user.findUnique({
        where: { id: studentId },
        select: { id: true, name: true, email: true },
      }),
    ]);

    return NextResponse.json({
      student,
      items,
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('GET /api/mentor/students/[id]/trades failed', error);
    return NextResponse.json({ error: 'Error al obtener trades del alumno' }, { status: 500 });
  }
}
