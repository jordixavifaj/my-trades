import path from 'path';
import { promises as fs } from 'fs';
import * as XLSX from 'xlsx';

export interface Execution {
  account: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: Date;
  commission: number;
}

const COLUMN_CANDIDATES: Record<keyof Omit<Execution, 'timestamp'> | 'timestamp', string[]> = {
  account: ['account', 'acct', 'cuenta'],
  symbol: ['symbol', 'ticker', 'stock', 'instrument'],
  side: ['side', 'action', 'b/s', 'type'],
  quantity: ['qty', 'quantity', 'shares', 'size', 'filled'],
  price: ['price', 'fill price', 'avg price', 'execution price'],
  timestamp: ['date/time', 'time/date', 'datetime', 'timestamp', 'time', 'date'],
  commission: ['commission', 'comm', 'fee', 'fees'],
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ');
}

function parseNumber(value: unknown, fallback = Number.NaN): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  const normalized = text.replace(/[()$€\s]/g, '').replace(/,/g, '');
  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parseSide(value: unknown): 'BUY' | 'SELL' | null {
  const side = String(value ?? '').trim().toUpperCase();
  if (side === 'BUY' || side === 'B') return 'BUY';
  if (side === 'SELL' || side === 'S' || side === 'SHORT') return 'SELL';
  return null;
}

function parseTimestamp(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const parts = XLSX.SSF.parse_date_code(value);
    if (parts) return new Date(parts.y, parts.m - 1, parts.d, parts.H, parts.M, parts.S);
  }
  return new Date(String(value ?? ''));
}

export async function parseExecutionsFromXLS(filePath: string): Promise<Execution[]> {
  console.log(`Attempting to parse file: ${filePath}`);
  
  // Verify file exists and is accessible
  try {
    const stats = await fs.stat(filePath);
    console.log(`File exists, size: ${stats.size} bytes`);
    await fs.access(filePath, fs.constants.R_OK);
    console.log('File is readable');
  } catch (error) {
    console.error(`File access error:`, error);
    throw new Error(`Cannot access file ${filePath}. The file may have been deleted or is not accessible. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  let workbook;
  try {
    console.log('Reading XLSX file...');
    // Try different reading options for better compatibility
    workbook = XLSX.readFile(filePath, { 
      cellDates: true, 
      raw: false,
      type: 'file'
    });
    console.log('XLSX file read successfully');
  } catch (error) {
    console.error('XLSX read error:', error);
    // Try alternative reading method
    try {
      console.log('Trying alternative XLSX reading method...');
      const data = await fs.readFile(filePath);
      workbook = XLSX.read(data, { 
        cellDates: true, 
        raw: false,
        type: 'buffer'
      });
      console.log('Alternative XLSX read successful');
    } catch (altError) {
      console.error('Alternative XLSX read also failed:', altError);
      throw new Error(`Failed to read XLSX file with both methods. Original error: ${error instanceof Error ? error.message : 'Unknown error'}. Alternative error: ${altError instanceof Error ? altError.message : 'Unknown error'}`);
    }
  }
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (rows.length === 0) return [];

  const keyLookup = new Map<string, string>();
  const headers = Object.keys(rows[0]);
  headers.forEach((key) => keyLookup.set(normalizeHeader(key), key));

  const resolveColumn = (field: keyof typeof COLUMN_CANDIDATES) => {
    for (const candidate of COLUMN_CANDIDATES[field]) {
      const key = keyLookup.get(candidate);
      if (key) return key;
    }
    return null;
  };

  const symbolColumn = resolveColumn('symbol');
  const sideColumn = resolveColumn('side');
  const quantityColumn = resolveColumn('quantity');
  const priceColumn = resolveColumn('price');
  const timestampColumn = resolveColumn('timestamp');
  const accountColumn = resolveColumn('account');
  const commissionColumn = resolveColumn('commission');

  if (!symbolColumn || !sideColumn || !quantityColumn || !priceColumn || !timestampColumn) {
    throw new Error(`Missing required columns in ${path.basename(filePath)}.`);
  }

  const executions: Execution[] = [];
  for (const row of rows) {
    const side = parseSide(row[sideColumn]);
    const timestamp = parseTimestamp(row[timestampColumn]);
    const quantity = parseNumber(row[quantityColumn]);
    const price = parseNumber(row[priceColumn]);

    if (!side || Number.isNaN(timestamp.getTime()) || !Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price <= 0) {
      continue;
    }

    executions.push({
      account: accountColumn ? String(row[accountColumn] ?? '').trim() || 'DEFAULT' : 'DEFAULT',
      symbol: String(row[symbolColumn] ?? '').trim().toUpperCase(),
      side,
      quantity,
      price,
      timestamp,
      commission: commissionColumn ? parseNumber(row[commissionColumn], 0) : 0,
    });
  }

  executions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return executions;
}
