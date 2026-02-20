import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUserWithFreshRole } from '@/lib/request-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireRequestUserWithFreshRole(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== 'MENTOR' && auth.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo mentores' }, { status: 403 });
  }

  try {
    // 1. Direct mentor assignments
    const assignments = await prisma.mentorAssignment.findMany({
      where: { mentorId: auth.id },
      select: {
        id: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            _count: { select: { trades: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    type StudentRow = {
      assignmentId: string | null;
      assignedAt: Date;
      id: string;
      name: string | null;
      email: string;
      role: string;
      joinedAt: Date;
      tradeCount: number;
      source: 'assignment' | 'community';
    };

    const assignedStudents: StudentRow[] = assignments.map((a: any) => ({
      assignmentId: a.id,
      assignedAt: a.createdAt,
      id: a.student.id,
      name: a.student.name,
      email: a.student.email,
      role: a.student.role,
      joinedAt: a.student.createdAt,
      tradeCount: a.student._count.trades,
      source: 'assignment',
    }));

    const assignedIds = new Set(assignedStudents.map((s) => s.id));

    // 2. Community members (if mentor is in any community, all other members are visible)
    const mentorCommunities = await prisma.communityMember.findMany({
      where: { userId: auth.id },
      select: { communityId: true },
    });

    let communityStudents: StudentRow[] = [];
    if (mentorCommunities.length > 0) {
      const communityIds = mentorCommunities.map((m) => m.communityId);
      const communityMembers = await prisma.communityMember.findMany({
        where: {
          communityId: { in: communityIds },
          userId: { not: auth.id },
        },
        select: {
          joinedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true,
              _count: { select: { trades: true } },
            },
          },
        },
        distinct: ['userId'],
      });

      communityStudents = communityMembers
        .filter((m) => !assignedIds.has(m.user.id) && m.user.role === 'STUDENT')
        .map((m) => ({
          assignmentId: null,
          assignedAt: m.joinedAt,
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          role: m.user.role,
          joinedAt: m.user.createdAt,
          tradeCount: m.user._count.trades,
          source: 'community',
        }));
    }

    const students: StudentRow[] = [...assignedStudents, ...communityStudents];

    return NextResponse.json({ students });
  } catch (error) {
    console.error('GET /api/mentor/students failed', error);
    return NextResponse.json({ error: 'Error al obtener alumnos' }, { status: 500 });
  }
}
