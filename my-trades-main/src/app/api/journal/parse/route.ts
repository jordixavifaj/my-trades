import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { parseExecutionsFromXLSDetailed } from '@/lib/executions-parser';
import { buildTradesFromExecutions } from '@/lib/trade-builder';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.csv', '.xls', '.xlsx'];

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type must be multipart/form-data' }, { status: 415 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: 'Uploaded file is empty' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: `File too large. Max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB` }, { status: 413 });
    }

    const lower = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      return NextResponse.json({ error: 'File must be CSV, XLS or XLSX' }, { status: 400 });
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-journal-'));
    const tempPath = path.join(tempDir, file.name);

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(tempPath, buffer);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const { executions, meta } = await parseExecutionsFromXLSDetailed(tempPath);
      if (executions.length === 0) {
        return NextResponse.json({ error: 'No valid executions found in file' }, { status: 400 });
      }

      const trades = buildTradesFromExecutions(executions);
      if (trades.length === 0) {
        return NextResponse.json({ error: 'No closed trades found in file' }, { status: 400 });
      }

      const serialized = trades.map((t) => ({
        id: t.id,
        ticker: t.symbol,
        date: t.entryTime.toISOString().slice(0, 10),
        direction: t.side,
        entry_time: t.entryTime.toISOString(),
        entry_price: t.entryPrice,
        exit_time: t.exitTime.toISOString(),
        exit_price: t.exitPrice,
        size: t.size,
        pnl: Math.round(t.pnl * 100) / 100,
        executions: t.executions.map((e) => ({
          symbol: e.symbol,
          side: e.side,
          quantity: e.quantity,
          price: e.price,
          timestamp: e.timestamp.toISOString(),
          commission: e.commission,
        })),
      }));

      return NextResponse.json({
        parse: meta,
        totalExecutions: executions.length,
        totalTrades: trades.length,
        trades: serialized,
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('Error parsing XLS for journal:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
