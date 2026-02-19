import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUser } from '@/lib/request-auth';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const auth = requireRequestUser(request);
    if (auth instanceof NextResponse) return auth;
    const user = auth;

    // Get count before deletion for audit
    const tradesCount = await prisma.trade.count({
      where: { userId: user.id }
    });

    if (tradesCount === 0) {
      return NextResponse.json({ message: 'No trades found to delete', deletedCount: 0 });
    }

    // Delete all trades and their associated fills (cascade delete)
    const result = await prisma.trade.deleteMany({
      where: { userId: user.id }
    });

    await createAuditLog({
      userId: user.id,
      action: 'DELETE_ALL_TRADES',
      reason: 'User requested deletion of all trades',
      newValue: { deletedCount: result.count, previousCount: tradesCount }
    });

    return NextResponse.json({ 
      message: 'All trades deleted successfully',
      deletedCount: result.count,
      previousCount: tradesCount
    });

  } catch (error) {
    console.error('Error deleting all trades:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
