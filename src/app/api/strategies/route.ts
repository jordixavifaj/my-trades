import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const strategies = await prisma.strategy.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(strategies);
}

export async function POST(request: NextRequest) {
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
