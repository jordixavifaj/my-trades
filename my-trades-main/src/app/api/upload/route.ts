import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRequestUser } from '@/lib/request-auth';
import { createAuditLog } from '@/lib/audit';
import { buildTradesFromExecutions } from '@/lib/trade-builder';
import { parseExecutionsFromXLSDetailed } from '@/lib/executions-parser';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.csv', '.xls', '.xlsx'];

export async function POST(request: NextRequest) {
  try {
    const auth = requireRequestUser(request);
    if (auth instanceof NextResponse) return auth;
    const user = auth;

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === '1';

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

      const fileHash = createHash('sha256').update(buffer).digest('hex');

      const existingBatch = await prisma.importBatch.findUnique({
        where: {
          userId_fileHash: {
            userId: user.id,
            fileHash,
          },
        },
      });

      if (existingBatch) {
        const tradesInBatch = await prisma.trade.count({
          where: {
            userId: user.id,
            importBatchId: existingBatch.id,
          },
        });

        if (tradesInBatch > 0 && !force) {
          return NextResponse.json(
            {
              message: 'Archivo ya importado. No se duplicaron trades.',
              stats: { totalExecutions: 0, totalTrades: 0 },
              deduped: true,
            },
            { status: 200 },
          );
        }

        // Either the trades were deleted (batch is orphaned) or user explicitly wants to re-import.
        // Delete old batch so we can create a fresh one with the same (userId, fileHash).
        await prisma.importBatch.delete({ where: { id: existingBatch.id } });
      }

      const batch = await prisma.importBatch.create({
        data: {
          userId: user.id,
          fileName: file.name,
          fileHash,
        },
      });
      
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

      const { executions, meta } = await parseExecutionsFromXLSDetailed(tempPath);
      if (executions.length === 0) {
        return NextResponse.json({ error: 'No valid executions found in file' }, { status: 400 });
      }

      const symbolCounts = executions.reduce<Record<string, number>>((acc, e) => {
        acc[e.symbol] = (acc[e.symbol] ?? 0) + 1;
        return acc;
      }, {});

      const trades = buildTradesFromExecutions(executions);
      if (trades.length === 0) {
        return NextResponse.json({ error: 'No closed trades found in file' }, { status: 400 });
      }

      // --- Trade-level dedup: skip trades that already exist for this user ---
      const newTrades = [];
      let skippedDuplicates = 0;

      for (const trade of trades) {
        const duplicate = await prisma.trade.findFirst({
          where: {
            userId: user.id,
            symbol: trade.symbol,
            openDate: trade.entryTime,
            closeDate: trade.exitTime,
            openPrice: trade.entryPrice,
            closePrice: trade.exitPrice,
            quantity: Math.round(trade.size),
            side: trade.side === 'LONG' ? 'BUY' : 'SELL',
          },
        });

        if (duplicate) {
          skippedDuplicates++;
        } else {
          newTrades.push(trade);
        }
      }

      if (newTrades.length === 0) {
        return NextResponse.json({
          message: `Todos los ${trades.length} trades ya existían. No se importó nada.`,
          stats: {
            parse: meta,
            symbolCounts,
            totalExecutions: executions.length,
            totalTrades: 0,
            skippedDuplicates,
          },
          deduped: true,
        });
      }

      const savedTrades = await prisma.$transaction(
        newTrades.map((trade) =>
          prisma.trade.create({
            data: {
              userId: user.id,
              importBatchId: batch.id,
              symbol: trade.symbol,
              status: 'CLOSED',
              openDate: trade.entryTime,
              closeDate: trade.exitTime,
              openPrice: trade.entryPrice,
              closePrice: trade.exitPrice,
              quantity: Math.round(trade.size),
              side: trade.side === 'LONG' ? 'BUY' : 'SELL',
              pnl: trade.pnl,
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
        reason: `Imported ${savedTrades.length} trades from ${file.name}` + (skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicados omitidos)` : ''),
        newValue: { fileName: file.name, fileHash, importBatchId: batch.id, trades: savedTrades.length, skippedDuplicates, executions: executions.length },
      });

      return NextResponse.json({
        message: skippedDuplicates > 0
          ? `Importados ${savedTrades.length} trades nuevos. ${skippedDuplicates} duplicados omitidos.`
          : 'Archivo XLS procesado correctamente',
        stats: {
          parse: meta,
          symbolCounts,
          totalExecutions: executions.length,
          totalTrades: savedTrades.length,
          skippedDuplicates,
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
