import path from 'path';
import { promises as fs } from 'fs';
import * as XLSX from 'xlsx';
import { format, parse } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

export interface Execution {
  account: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  isClose?: boolean;
  quantity: number;
  price: number;
  timestamp: Date;
  commission: number;
}

export interface ParseExecutionsMeta {
  sheetNames: string[];
  totalRows: number;
  validExecutions: number;
  skippedMissingSymbol: number;
  skippedInvalidFields: number;
}

type ExecutionColumnField = 'account' | 'symbol' | 'side' | 'quantity' | 'price' | 'timestamp' | 'commission';

const COLUMN_CANDIDATES: Record<ExecutionColumnField, string[]> = {
  account: ['account', 'acct', 'cuenta'],
  symbol: ['symbol', 'ticker', 'stock', 'instrument'],
  side: ['side', 'action', 'b/s', 'b s', 'type'],
  quantity: ['qty', 'quantity', 'shares', 'size', 'filled'],
  price: ['price', 'fill price', 'avg price', 'execution price'],
  timestamp: ['date/time', 'time/date', 'datetime', 'timestamp', 'time', 'date'],
  commission: ['commission', 'comm', 'fee', 'fees', 'fees total'],
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ');
}

function parseNumber(value: unknown, fallback = Number.NaN): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const text = String(value ?? '').trim();
  if (!text) return fallback;

  const isParensNegative = /^\(.*\)$/.test(text);
  let normalized = text.replace(/[()$€\s]/g, '');

  if (normalized.includes(',') && !normalized.includes('.')) {
    normalized = normalized.replace(/,/g, '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  const numeric = Number.parseFloat(normalized);
  if (!Number.isFinite(numeric)) return fallback;
  return isParensNegative ? -numeric : numeric;
}

function parseSide(value: unknown): { side: 'BUY' | 'SELL'; isClose?: boolean } | null {
  const raw = String(value ?? '').trim().toUpperCase();
  if (raw === 'BUY' || raw === 'B') return { side: 'BUY' };
  if (raw === 'SELL' || raw === 'S' || raw === 'SHORT') return { side: 'SELL' };
  // In DAS Trader exports, 'T' means 'Sell Short' (opening/adding to a short position).
  // It is functionally identical to SELL for position tracking purposes.
  if (raw === 'T') return { side: 'SELL' };
  return null;
}

function parseTimestamp(value: unknown): Date {
  const toNyUtc = (date: Date) => {
    const naive = format(date, 'yyyy-MM-dd HH:mm:ss');
    return fromZonedTime(naive, 'America/New_York');
  };

  if (value instanceof Date) return toNyUtc(value);

  if (typeof value === 'number') {
    const parts = XLSX.SSF.parse_date_code(value);
    if (parts) {
      const naive = new Date(parts.y, parts.m - 1, parts.d, parts.H, parts.M, parts.S);
      return toNyUtc(naive);
    }
  }

  const raw = String(value ?? '').trim();
  if (!raw) return new Date('');

  // If it's an ISO timestamp with timezone, trust it.
  if (/\dT\d/.test(raw) && /Z$|[+-]\d\d:?\d\d$/.test(raw)) {
    const iso = new Date(raw);
    return Number.isNaN(iso.getTime()) ? new Date('') : iso;
  }

  // Brokerage export typically uses: 02/19/26 11:03:19 (NY time)
  const candidates = [
    'MM/dd/yy HH:mm:ss',
    'MM/dd/yyyy HH:mm:ss',
    'MM/dd/yy HH:mm',
    'MM/dd/yyyy HH:mm',
    'yyyy-MM-dd HH:mm:ss',
    'yyyy-MM-dd HH:mm',
  ];

  for (const fmt of candidates) {
    const parsed = parse(raw, fmt, new Date());
    if (!Number.isNaN(parsed.getTime())) return toNyUtc(parsed);
  }

  const normalized = raw.replace(/\./g, '/');
  for (const fmt of candidates) {
    const parsed = parse(normalized, fmt, new Date());
    if (!Number.isNaN(parsed.getTime())) return toNyUtc(parsed);
  }

  const loose = new Date(raw);
  if (!Number.isNaN(loose.getTime())) return toNyUtc(loose);
  return new Date('');
}

export async function parseExecutionsFromXLSDetailed(
  filePath: string,
): Promise<{ executions: Execution[]; meta: ParseExecutionsMeta }> {
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
  const sheetNames = workbook.SheetNames.slice();
  const allRows: Array<Record<string, unknown>> = [];
  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    if (rows.length === 0) continue;
    allRows.push(...rows);
  }

  if (allRows.length === 0) {
    return {
      executions: [],
      meta: {
        sheetNames,
        totalRows: 0,
        validExecutions: 0,
        skippedMissingSymbol: 0,
        skippedInvalidFields: 0,
      },
    };
  }

  const keyLookup = new Map<string, string>();
  const headers = Object.keys(allRows[0]);
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

  const feeColumns = headers.filter((h) => {
    const norm = normalizeHeader(h);
    return (
      norm === 'comm' ||
      norm === 'commission' ||
      norm === 'ecn fee' ||
      norm === 'sec' ||
      norm === 'taf' ||
      norm === 'nscc' ||
      norm === 'clr' ||
      norm === 'cat' ||
      norm === 'misc' ||
      norm === 'fees' ||
      norm === 'fees total'
    );
  });

  if (!symbolColumn || !sideColumn || !quantityColumn || !priceColumn || !timestampColumn) {
    throw new Error(`Missing required columns in ${path.basename(filePath)}.`);
  }

  let skippedMissingSymbol = 0;
  let skippedInvalidFields = 0;

  const executions: Execution[] = [];
  for (const row of allRows) {
    const sideParsed = parseSide(row[sideColumn]);
    const timestamp = parseTimestamp(row[timestampColumn]);
    const quantity = parseNumber(row[quantityColumn]);
    const price = parseNumber(row[priceColumn]);

    const symbol = String(row[symbolColumn] ?? '').trim().toUpperCase();
    if (!symbol) {
      skippedMissingSymbol += 1;
      continue;
    }

    let commission = 0;
    if (feeColumns.length > 0) {
      for (const col of feeColumns) {
        commission += parseNumber(row[col], 0);
      }
    } else if (commissionColumn) {
      commission = parseNumber(row[commissionColumn], 0);
    }

    if (!sideParsed || Number.isNaN(timestamp.getTime()) || !Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price <= 0) {
      skippedInvalidFields += 1;
      continue;
    }

    executions.push({
      account: accountColumn ? String(row[accountColumn] ?? '').trim() || 'DEFAULT' : 'DEFAULT',
      symbol,
      side: sideParsed.side,
      isClose: sideParsed.isClose,
      quantity,
      price,
      timestamp,
      commission,
    });
  }

  executions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const meta: ParseExecutionsMeta = {
    sheetNames,
    totalRows: allRows.length,
    validExecutions: executions.length,
    skippedMissingSymbol,
    skippedInvalidFields,
  };

  console.log('XLS parse meta:', meta);

  return { executions, meta };
}

export async function parseExecutionsFromXLS(filePath: string): Promise<Execution[]> {
  const { executions } = await parseExecutionsFromXLSDetailed(filePath);
  return executions;
}
