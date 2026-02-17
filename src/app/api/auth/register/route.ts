import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, name } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y password son obligatorios' }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: 'El usuario ya existe' }, { status: 409 });
  }

  const passwordHash = createHash('sha256').update(password).digest('hex');
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'TRADER',
    },
  });

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
