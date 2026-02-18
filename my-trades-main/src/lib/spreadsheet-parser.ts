import { read, utils } from 'xlsx';

function csvEscape(value: unknown): string {
  const str = String(value ?? '');
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

export async function readSpreadsheetAsCsvLines(file: File): Promise<string[]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = read(buffer, { type: 'buffer', cellDates: false, raw: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rows = utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  return rows.map((cells) => cells.map(csvEscape).join(','));
}
