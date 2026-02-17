import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { groupFillsIntoTrades, processDasTraderCSV } from '@/lib/csv-processor';
import { authCookieName, verifySessionToken } from '@/lib/auth';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.csv', '.xls', '.xlsx'];

export async function POST(request: NextRequest) {
  try {
    const user = verifySessionToken(request.cookies.get(authCookieName)?.value);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type must be multipart/form-data' }, { status: 415 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'Uploaded file is empty' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File is too large. Max allowed size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB` },
        { status: 413 },
      );
    }

    const lower = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      return NextResponse.json({ error: 'File must be CSV, XLS o XLSX' }, { status: 400 });
    }


    if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) {
      return NextResponse.json(
        { error: 'Formato XLS/XLSX detectado. Exporta a CSV para procesarlo con fidelidad DAS Trader.' },
        { status: 400 },
      );
    }

    const lines = await getFileLines(file);
    const { fills, errors } = processDasTraderCSV(lines);

    if (fills.length === 0) {
      return NextResponse.json(
        { error: 'No valid fills found in file', validationErrors: errors.slice(0, 10) },
        { status: 400 },
      );
    }

    const tradeGroups = groupFillsIntoTrades(fills);
    const savedTrades = await prisma.$transaction(
      tradeGroups.map((tradeGroup) => {
        const firstFill = tradeGroup.fills[0];
        const lastFill = tradeGroup.fills[tradeGroup.fills.length - 1];

        const pnl =
          tradeGroup.status === 'CLOSED'
            ? tradeGroup.fills.reduce((sum, fill) => {
                const direction = fill.side === 'SELL' ? 1 : -1;
                return sum + direction * fill.price * fill.quantity;
              }, 0)
            : null;

        return prisma.trade.create({
          data: {
            symbol: tradeGroup.symbol,
            status: tradeGroup.status,
            openDate: firstFill.timestamp,
            closeDate: tradeGroup.status === 'CLOSED' ? lastFill.timestamp : null,
            openPrice: firstFill.price,
            closePrice: tradeGroup.status === 'CLOSED' ? lastFill.price : null,
            quantity: tradeGroup.quantity,
            side: tradeGroup.side,
            pnl,
            commission: tradeGroup.totalCommission,
            fills: {
              create: tradeGroup.fills.map((fill) => ({
                symbol: fill.symbol,
                price: fill.price,
                quantity: fill.quantity,
                side: fill.side,
                timestamp: fill.timestamp,
                commission: fill.commission,
              })),
            },
          },
          include: {
            fills: true,
          },
        });
      }),
    );

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPLOAD_TRADES',
        reason: `Imported ${savedTrades.length} trades from ${file.name}`,
        newValueJson: JSON.stringify({ fileName: file.name, trades: savedTrades.length, errors: errors.length }),
      },
    });

    return NextResponse.json({
      message: 'Archivo procesado correctamente',
      stats: {
        totalFills: fills.length,
        totalTrades: tradeGroups.length,
        closedTrades: tradeGroups.filter((trade) => trade.status === 'CLOSED').length,
        openTrades: tradeGroups.filter((trade) => trade.status === 'OPEN').length,
        skippedRows: errors.length,
      },
      validationErrors: errors.slice(0, 10),
      trades: savedTrades,
    });
  } catch (error) {
    console.error('Error processing upload:', error);

    return NextResponse.json(
      {
        error: 'Internal server error while processing upload',
      },
      { status: 500 },
    );
  }
}

async function getFileLines(file: File) {
  const text = await file.text();
  return text.split(/\r?\n/);
}
