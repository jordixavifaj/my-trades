import { parse } from 'date-fns';
import { CSVProcessingResult, ProcessedFill } from '@/types/trading';

const HEADER_ALIASES: Record<string, string[]> = {
  symbol: ['symbol', 'ticker'],
  timestamp: ['time/date', 'date/time', 'timestamp', 'date', 'time'],
  side: ['side', 'action', 'b/s', 'bs'],
  price: ['price', 'fill price'],
  quantity: ['quantity', 'qty', 'shares'],
  commission: ['commission', 'comm'],
};

export function processDasTraderCSV(csvData: string[]): CSVProcessingResult {
  const lines = csvData.map((line) => line.trim()).filter(Boolean);

  if (lines.length < 2) {
    return { fills: [], errors: [{ line: 1, reason: 'CSV file is empty or missing data rows' }] };
  }

  const headerFields = parseCSVLine(lines[0]).map(normalizeHeader);
  const headerMap = buildHeaderMap(headerFields);
  const missingColumns = getMissingColumns(headerMap);

  if (missingColumns.length > 0) {
    return {
      fills: [],
      errors: [{ line: 1, reason: `Missing required columns: ${missingColumns.join(', ')}` }],
    };
  }

  const fills: ProcessedFill[] = [];
  const errors: CSVProcessingResult['errors'] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;

    const fields = parseCSVLine(rawLine);

    try {
      const symbol = getField(fields, headerMap.symbol).toUpperCase();
      const sideRaw = getField(fields, headerMap.side).toUpperCase();
      const sideNormalized = normalizeSide(sideRaw);
      const side = sideNormalized === 'BUY' || sideNormalized === 'SELL' ? sideNormalized : null;
      const price = parseSafeFloat(getField(fields, headerMap.price));
      const quantity = parseSafeInt(getField(fields, headerMap.quantity));
      const commission = parseSafeFloat(getField(fields, headerMap.commission), 0);
      const timestamp = parseDasTraderDate(getField(fields, headerMap.timestamp));

      if (!symbol) {
        throw new Error('Missing symbol');
      }
      if (!side) {
        throw new Error(`Invalid side "${sideRaw}"`);
      }
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error(`Invalid price "${getField(fields, headerMap.price)}"`);
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity "${getField(fields, headerMap.quantity)}"`);
      }
      if (!Number.isFinite(commission)) {
        throw new Error(`Invalid commission "${getField(fields, headerMap.commission)}"`);
      }
      if (Number.isNaN(timestamp.getTime())) {
        throw new Error(`Invalid timestamp "${getField(fields, headerMap.timestamp)}"`);
      }

      fills.push({
        symbol,
        side,
        price,
        quantity,
        commission,
        timestamp,
      });
    } catch (error) {
      errors.push({
        line: i + 1,
        reason: error instanceof Error ? error.message : 'Unknown parsing error',
      });
    }
  }

  return { fills, errors };
}

function buildHeaderMap(headerFields: string[]) {
  const findIndex = (aliases: string[]) => headerFields.findIndex((header) => aliases.includes(header));

  return {
    symbol: findIndex(HEADER_ALIASES.symbol),
    timestamp: findIndex(HEADER_ALIASES.timestamp),
    side: findIndex(HEADER_ALIASES.side),
    price: findIndex(HEADER_ALIASES.price),
    quantity: findIndex(HEADER_ALIASES.quantity),
    commission: findIndex(HEADER_ALIASES.commission),
  };
}

function getMissingColumns(headerMap: Record<string, number>): string[] {
  return Object.entries(headerMap)
    .filter(([, index]) => index < 0)
    .map(([field]) => field)
    .filter((field) => field !== 'commission');
}

function getField(fields: string[], index: number): string {
  if (index < 0) return '';
  return (fields[index] ?? '').trim();
}

function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/, '').trim().toLowerCase();
}

function parseSafeFloat(value: string, fallback = Number.NaN): number {
  const normalized = normalizeNumberString(value);
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseSafeInt(value: string): number {
  const normalized = normalizeNumberString(value);
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseCSVLine(line: string): string[] {
  const delimiter = detectDelimiter(line);
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function detectDelimiter(line: string): ',' | ';' | '\t' {
  let inQuotes = false;
  let commas = 0;
  let semicolons = 0;
  let tabs = 0;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes) {
      if (char === ',') commas++;
      if (char === ';') semicolons++;
      if (char === '\t') tabs++;
    }
  }

  if (tabs > commas && tabs > semicolons) return '\t';
  return semicolons > commas ? ';' : ',';
}

function normalizeSide(sideRaw: string): string {
  const cleaned = sideRaw.trim().toUpperCase();
  if (cleaned === 'B' || cleaned === 'BUY') return 'BUY';
  if (cleaned === 'S' || cleaned === 'SELL') return 'SELL';
  return cleaned;
}

function normalizeNumberString(value: string): string {
  const raw = (value ?? '').trim();
  if (!raw) return raw;

  const cleaned = raw.replace(/[$\s]/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  // If it only has comma, assume comma is decimal separator.
  if (lastComma >= 0 && lastDot < 0) {
    return cleaned.replace(/\./g, '').replace(',', '.');
  }

  // If it has both, pick the last separator as decimal and strip the other as thousand separator.
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      return cleaned.replace(/\./g, '').replace(',', '.');
    }
    return cleaned.replace(/,/g, '');
  }

  // Only dot (or neither): remove commas just in case.
  return cleaned.replace(/,/g, '');
}

function parseDasTraderDate(dateString: string): Date {
  const trimmed = (dateString ?? '').trim();
  const formats = [
    'MM/dd/yyyy HH:mm:ss',
    'MM/dd/yyyy h:mm:ss a',
    'MM/dd/yyyy HH:mm',
    'MM/dd/yy HH:mm:ss',
    'MM/dd/yy HH:mm',
    'dd/MM/yy HH:mm:ss',
    'dd/MM/yy HH:mm',
    'yyyy-MM-dd HH:mm:ss',
    'yyyy-MM-dd HH:mm',
    'MM/dd/yyyy',
    'MM/dd/yy',
    'dd/MM/yy',
    'yyyy-MM-dd',
  ];

  for (const format of formats) {
    const parsed = parse(trimmed, format, new Date());
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const yyMatch = trimmed.match(/\b(\d{2})\b(?!.*\b\d{4}\b)/);

      if (year < 2000 && yyMatch) {
        const yy = Number.parseInt(yyMatch[1], 10);
        if (Number.isFinite(yy)) {
          const fixed = new Date(parsed);
          fixed.setFullYear(2000 + yy);
          return fixed;
        }
      }

      return parsed;
    }
  }

  return new Date(trimmed);
}

export function groupFillsIntoTrades(fills: ProcessedFill[]): Array<{
  symbol: string;
  fills: ProcessedFill[];
  status: 'OPEN' | 'CLOSED';
  side: 'BUY' | 'SELL';
  quantity: number;
  totalCommission: number;
}> {
  const symbolGroups = new Map<string, ProcessedFill[]>();

  fills.forEach((fill) => {
    if (!symbolGroups.has(fill.symbol)) {
      symbolGroups.set(fill.symbol, []);
    }
    symbolGroups.get(fill.symbol)!.push(fill);
  });

  symbolGroups.forEach((symbolFills) => {
    symbolFills.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  });

  const trades: Array<{
    symbol: string;
    fills: ProcessedFill[];
    status: 'OPEN' | 'CLOSED';
    side: 'BUY' | 'SELL';
    quantity: number;
    totalCommission: number;
  }> = [];

  symbolGroups.forEach((symbolFills, symbol) => {
    let currentTrade: ProcessedFill[] = [];
    let currentPosition = 0;

    for (const fill of symbolFills) {
      const signedQuantity = fill.side === 'BUY' ? fill.quantity : -fill.quantity;

      if (currentTrade.length === 0) {
        currentTrade = [fill];
        currentPosition = signedQuantity;
        continue;
      }

      const newPosition = currentPosition + signedQuantity;

      // Trade closes exactly when position returns to zero.
      if (newPosition === 0) {
        currentTrade.push(fill);
        trades.push({
          symbol,
          fills: [...currentTrade],
          status: 'CLOSED',
          side: currentTrade[0].side,
          quantity: Math.abs(currentPosition),
          totalCommission: currentTrade.reduce((sum, f) => sum + f.commission, 0),
        });
        currentTrade = [];
        currentPosition = 0;
        continue;
      }

      // Handle flip (e.g. +100 then -150): close existing trade and open a new one with remaining qty.
      if (Math.sign(currentPosition) !== Math.sign(newPosition)) {
        const closeQuantity = Math.abs(currentPosition);
        const openQuantity = Math.abs(newPosition);

        const closingFill: ProcessedFill = {
          ...fill,
          quantity: closeQuantity,
          commission: fill.commission * (closeQuantity / fill.quantity),
        };

        currentTrade.push(closingFill);
        trades.push({
          symbol,
          fills: [...currentTrade],
          status: 'CLOSED',
          side: currentTrade[0].side,
          quantity: Math.abs(currentPosition),
          totalCommission: currentTrade.reduce((sum, f) => sum + f.commission, 0),
        });

        const openingFill: ProcessedFill = {
          ...fill,
          quantity: openQuantity,
          commission: fill.commission * (openQuantity / fill.quantity),
        };

        currentTrade = [openingFill];
        currentPosition = fill.side === 'BUY' ? openQuantity : -openQuantity;
        continue;
      }

      currentTrade.push(fill);
      currentPosition = newPosition;
    }

    if (currentTrade.length > 0) {
      trades.push({
        symbol,
        fills: currentTrade,
        status: 'OPEN',
        side: currentTrade[0].side,
        quantity: Math.abs(currentPosition),
        totalCommission: currentTrade.reduce((sum, f) => sum + f.commission, 0),
      });
    }
  });

  return trades;
}
