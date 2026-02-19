import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUser } from '@/lib/request-auth';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const auth = requireRequestUser(request);
    if (auth instanceof NextResponse) return auth;
    const user = auth;

    // Get all trades for the user
    const allTrades = await prisma.trade.findMany({
      where: { userId: user.id },
      include: { fills: true }
    });

    if (allTrades.length === 0) {
      return NextResponse.json({ message: 'No trades found to clean up', deleted: 0 });
    }

    // Find duplicates based on symbol, openDate, openPrice, quantity, and side
    const tradeGroups = new Map<string, typeof allTrades>();
    
    allTrades.forEach(trade => {
      const key = `${trade.symbol}-${trade.openDate.toISOString()}-${trade.openPrice}-${trade.quantity}-${trade.side}`;
      if (!tradeGroups.has(key)) {
        tradeGroups.set(key, []);
      }
      tradeGroups.get(key)!.push(trade);
    });

    let deletedCount = 0;
    const duplicatesToDelete: string[] = [];

    // For each group with duplicates, keep the first one and delete the rest
    tradeGroups.forEach(group => {
      if (group.length > 1) {
        // Sort by ID to keep the oldest (first created)
        group.sort((a, b) => a.id.localeCompare(b.id));
        
        // Keep the first, delete the rest
        const toDelete = group.slice(1);
        toDelete.forEach(trade => {
          duplicatesToDelete.push(trade.id);
        });
      }
    });

    // Delete the duplicates
    if (duplicatesToDelete.length > 0) {
      await prisma.trade.deleteMany({
        where: {
          id: { in: duplicatesToDelete },
          userId: user.id
        }
      });
      deletedCount = duplicatesToDelete.length;
    }

    await createAuditLog({
      userId: user.id,
      action: 'CLEANUP_TRADES',
      reason: `Removed ${deletedCount} duplicate trades`,
      newValue: { deletedCount, totalTrades: allTrades.length }
    });

    return NextResponse.json({ 
      message: `Cleaned up ${deletedCount} duplicate trades`,
      deleted: deletedCount,
      totalBefore: allTrades.length,
      totalAfter: allTrades.length - deletedCount
    });

  } catch (error) {
    console.error('Error cleaning up trades:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
