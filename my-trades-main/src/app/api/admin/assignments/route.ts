import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUserWithFreshRole } from '@/lib/request-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  const assignments = await prisma.mentorAssignment.findMany({
    include: {
      mentor: { select: { id: true, name: true, email: true } },
      student: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ assignments });
}

export async function POST(request: NextRequest) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const mentorId = typeof body.mentorId === 'string' ? body.mentorId : '';
  const studentId = typeof body.studentId === 'string' ? body.studentId : '';

  if (!mentorId || !studentId) {
    return NextResponse.json({ error: 'mentorId y studentId requeridos' }, { status: 400 });
  }

  if (mentorId === studentId) {
    return NextResponse.json({ error: 'Un usuario no puede ser su propio mentor' }, { status: 400 });
  }

  try {
    const assignment = await prisma.mentorAssignment.create({
      data: { mentorId, studentId },
      include: {
        mentor: { select: { id: true, name: true, email: true } },
        student: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json(assignment, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Esta asignación ya existe' }, { status: 409 });
    }
    if (error?.code === 'P2003') {
      return NextResponse.json({ error: 'Mentor o alumno no encontrado' }, { status: 404 });
    }
    console.error('POST /api/admin/assignments failed', error);
    return NextResponse.json({ error: 'Error al crear asignación' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  try {
    await prisma.mentorAssignment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/admin/assignments failed', error);
    return NextResponse.json({ error: 'Error al eliminar asignación' }, { status: 500 });
  }
}
