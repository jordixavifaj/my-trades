import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authCookieName, verifySessionToken } from '@/lib/auth';

export async function GET() {
  const strategies = await prisma.strategy.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(strategies);
}

export async function POST(request: NextRequest) {
  const user = verifySessionToken(request.cookies.get(authCookieName)?.value);
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
  }

  const body = await request.json();
  const strategy = await prisma.strategy.create({
    data: {
      name: body.name,
      description: body.description,
      isActive: body.isActive ?? true,
    },
  });
  return NextResponse.json(strategy, { status: 201 });
}
