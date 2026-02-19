import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUser } from '@/lib/request-auth';
import { createAuditLog } from '@/lib/audit';
import { buildTradesFromExecutions } from '@/lib/trade-builder';
import { parseExecutionsFromXLS } from '@/lib/executions-parser';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.csv', '.xls', '.xlsx'];

export async function POST(request: NextRequest) {
  try {
    const auth = requireRequestUser(request);
    if (auth instanceof NextResponse) return auth;
    const user = auth;

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type must be multipart/form-data' }, { status: 415 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: 'Uploaded file is empty' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: `File is too large. Max allowed size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB` }, { status: 413 });
    }

    const lower = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      return NextResponse.json({ error: 'File must be CSV, XLS o XLSX' }, { status: 400 });
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-upload-'));
    const tempPath = path.join(tempDir, file.name);

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      console.log(`File buffer created, size: ${buffer.length} bytes`);
      
      await fs.writeFile(tempPath, buffer);
      console.log(`File written to: ${tempPath}`);

      // Longer delay to ensure file is fully written to disk
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify file exists before parsing
      try {
        await fs.access(tempPath);
        const stats = await fs.stat(tempPath);
        console.log(`Temp file verified, size: ${stats.size} bytes`);
      } catch (error) {
        console.error('Temp file verification failed:', error);
        throw new Error(`Temporary file not accessible: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      const executions = await parseExecutionsFromXLS(tempPath);
      if (executions.length === 0) {
        return NextResponse.json({ error: 'No valid executions found in file' }, { status: 400 });
      }

      const trades = buildTradesFromExecutions(executions);
      if (trades.length === 0) {
        return NextResponse.json({ error: 'No closed trades found in file' }, { status: 400 });
      }

      const savedTrades = await prisma.$transaction(
        trades.map((trade) =>
          prisma.trade.create({
            data: {
              userId: user.id,
              symbol: trade.symbol,
              status: 'CLOSED',
              openDate: trade.entryTime,
              closeDate: trade.exitTime,
              openPrice: trade.entryPrice,
              closePrice: trade.exitPrice,
              quantity: Math.round(trade.size),
              side: trade.side === 'LONG' ? 'BUY' : 'SELL',
              pnl: trade.pnl + trade.executions.reduce((sum, fill) => sum + fill.commission, 0),
              commission: trade.executions.reduce((sum, fill) => sum + fill.commission, 0),
              fills: {
                create: trade.executions.map((fill) => ({
                  symbol: fill.symbol,
                  price: fill.price,
                  quantity: Math.round(fill.quantity),
                  side: fill.side,
                  timestamp: fill.timestamp,
                  commission: fill.commission,
                })),
              },
            },
            include: { fills: true },
          }),
        ),
      );

      await createAuditLog({
        userId: user.id,
        action: 'UPLOAD_TRADES',
        reason: `Imported ${savedTrades.length} trades from ${file.name}`,
        newValue: { fileName: file.name, trades: savedTrades.length, executions: executions.length },
      });

      return NextResponse.json({
        message: 'Archivo XLS procesado correctamente',
        stats: {
          totalExecutions: executions.length,
          totalTrades: savedTrades.length,
        },
        trades: savedTrades,
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('Error processing upload:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error while processing upload' }, { status: 500 });
  }
}
