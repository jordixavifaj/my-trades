import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

function runUnzip(args: string[]) {
  return new Promise<string>((resolve, reject) => {
    execFile('unzip', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeCsvValue(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function parseSharedStrings(xml: string) {
  const values: string[] = [];
  const siRegex = /<si[^>]*>([\s\S]*?)<\/si>/g;
  let siMatch: RegExpExecArray | null = siRegex.exec(xml);
  while (siMatch) {
    const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let tMatch: RegExpExecArray | null = tRegex.exec(siMatch[1]);
    const parts: string[] = [];
    while (tMatch) {
      parts.push(decodeXml(tMatch[1]));
      tMatch = tRegex.exec(siMatch[1]);
    }
    values.push(parts.join(''));
    siMatch = siRegex.exec(xml);
  }
  return values;
}

function colToIndex(cellRef: string) {
  const letters = cellRef.replace(/\d+/g, '');
  let index = 0;
  for (let i = 0; i < letters.length; i++) index = index * 26 + (letters.charCodeAt(i) - 64);
  return index - 1;
}

function parseSheetXml(xml: string, sharedStrings: string[]) {
  const rows: string[][] = [];
  const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null = rowRegex.exec(xml);

  while (rowMatch) {
    const cells: string[] = [];
    const cellRegex = /<c\s+([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch: RegExpExecArray | null = cellRegex.exec(rowMatch[1]);
    while (cellMatch) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const refMatch = attrs.match(/r="([A-Z]+\d+)"/);
      const typeMatch = attrs.match(/t="([^"]+)"/);
      const valueMatch = body.match(/<v[^>]*>([\s\S]*?)<\/v>/);
      const inlineMatch = body.match(/<t[^>]*>([\s\S]*?)<\/t>/);
      const idx = refMatch ? colToIndex(refMatch[1]) : cells.length;
      let value = '';
      if (typeMatch && typeMatch[1] === 's' && valueMatch) value = sharedStrings[Number.parseInt(valueMatch[1], 10)] ?? '';
      else if (inlineMatch) value = decodeXml(inlineMatch[1]);
      else if (valueMatch) value = decodeXml(valueMatch[1]);
      cells[idx] = value;
      cellMatch = cellRegex.exec(rowMatch[1]);
    }

    rows.push(cells.map((v) => v ?? ''));
    rowMatch = rowRegex.exec(xml);
  }

  return rows;
}

function parseSpreadsheetText(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) {
    throw new Error('Archivo sin contenido legible.');
  }

  if (lines.some((line) => line.includes(','))) return lines;
  if (lines.some((line) => line.includes('\t'))) {
    return lines.map((line) => line.split('\t').map((value) => escapeCsvValue(value.trim())).join(','));
  }

  return lines.map((line) => escapeCsvValue(line));
}

export async function readSpreadsheetAsCsvLines(file: File): Promise<string[]> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.xls')) {
    // Some brokers export tab-delimited text with .xls extension.
    const text = await file.text();
    return parseSpreadsheetText(text);
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xlsx-'));
  const tempFile = path.join(tempDir, file.name);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempFile, buffer);

    const workbookXml = await runUnzip(['-p', tempFile, 'xl/workbook.xml']);
    const sheetTargets = Array.from(workbookXml.matchAll(/<sheet[^>]+r:id="([^"]+)"[^>]*>/g)).map((m) => m[1]);
    const relsXml = await runUnzip(['-p', tempFile, 'xl/_rels/workbook.xml.rels']);

    const relationshipMap = new Map<string, string>();
    Array.from(relsXml.matchAll(/<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g)).forEach((match) => {
      relationshipMap.set(match[1], match[2]);
    });

    const sharedStringsXml = await runUnzip(['-p', tempFile, 'xl/sharedStrings.xml']).catch(() => '');
    const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];

    for (const relationshipId of sheetTargets) {
      const target = relationshipMap.get(relationshipId);
      if (!target) continue;
      const normalizedTarget = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.?\/?/, '')}`;
      const sheetXml = await runUnzip(['-p', tempFile, normalizedTarget]).catch(() => '');
      if (!sheetXml) continue;

      const rows = parseSheetXml(sheetXml, sharedStrings)
        .map((cells) => cells.map((value) => escapeCsvValue(value.trim())).join(','))
        .filter((line) => line.replace(/,/g, '').trim().length > 0);

      if (rows.length > 0) {
        return rows;
      }
    }

    throw new Error('No se encontró una hoja con datos en el archivo XLSX.');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
