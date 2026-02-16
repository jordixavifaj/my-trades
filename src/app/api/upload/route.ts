import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processDasTraderCSV, groupFillsIntoTrades } from '@/lib/csv-processor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'File must be a CSV' },
        { status: 400 }
      );
    }
    
    // Read file content
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file is empty or invalid' },
        { status: 400 }
      );
    }
    
    // Process CSV data
    const fills = processDasTraderCSV(lines);
    
    if (fills.length === 0) {
      return NextResponse.json(
        { error: 'No valid fills found in CSV' },
        { status: 400 }
      );
    }
    
    // Group fills into trades
    const tradeGroups = groupFillsIntoTrades(fills);
    
    // Save to database
    const savedTrades = [];
    
    for (const tradeGroup of tradeGroups) {
      const firstFill = tradeGroup.fills[0];
      const lastFill = tradeGroup.fills[tradeGroup.fills.length - 1];
      
      // Calculate P&L for closed trades
      let pnl = 0;
      if (tradeGroup.status === 'CLOSED') {
        const buyFills = tradeGroup.fills.filter(f => f.side === 'BUY');
        const sellFills = tradeGroup.fills.filter(f => f.side === 'SELL');
        
        const totalBuyCost = buyFills.reduce((sum, fill) => sum + (fill.price * fill.quantity), 0);
        const totalSellRevenue = sellFills.reduce((sum, fill) => sum + (fill.price * fill.quantity), 0);
        
        pnl = totalSellRevenue - totalBuyCost;
      }
      
      // Create trade
      const trade = await prisma.trade.create({
        data: {
          symbol: tradeGroup.symbol,
          status: tradeGroup.status,
          openDate: firstFill.timestamp,
          closeDate: tradeGroup.status === 'CLOSED' ? lastFill.timestamp : null,
          openPrice: firstFill.price,
          closePrice: tradeGroup.status === 'CLOSED' ? lastFill.price : null,
          quantity: tradeGroup.quantity,
          side: tradeGroup.side,
          pnl: tradeGroup.status === 'CLOSED' ? pnl : null,
          commission: tradeGroup.totalCommission,
          fills: {
            create: tradeGroup.fills.map(fill => ({
              symbol: fill.symbol,
              price: fill.price,
              quantity: fill.quantity,
              side: fill.side,
              timestamp: fill.timestamp,
              commission: fill.commission,
            }))
          }
        },
        include: {
          fills: true
        }
      });
      
      savedTrades.push(trade);
    }
    
    return NextResponse.json({
      message: 'CSV processed successfully',
      stats: {
        totalFills: fills.length,
        totalTrades: tradeGroups.length,
        closedTrades: tradeGroups.filter(t => t.status === 'CLOSED').length,
        openTrades: tradeGroups.filter(t => t.status === 'OPEN').length
      },
      trades: savedTrades
    });
    
  } catch (error) {
    console.error('Error processing CSV:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
