import { DasTraderFill, ProcessedFill } from '@/types/trading';
import { parse } from 'date-fns';

export function processDasTraderCSV(csvData: string[]): ProcessedFill[] {
  const fills: ProcessedFill[] = [];
  
  // Skip header row and process each line
  for (let i = 1; i < csvData.length; i++) {
    const line = csvData[i].trim();
    if (!line) continue;
    
    const fields = parseCSVLine(line);
    
    if (fields.length < 15) continue; // Ensure we have enough fields
    
    try {
      const fill: ProcessedFill = {
        symbol: fields[0] || '',
        price: parseFloat(fields[4] || '0'),
        quantity: parseInt(fields[5] || '0'),
        side: (fields[3] || 'BUY').toUpperCase() as 'BUY' | 'SELL',
        timestamp: parseDasTraderDate(fields[1] || ''),
        commission: parseFloat(fields[14] || '0')
      };
      
      // Validate the fill data
      if (fill.symbol && fill.price > 0 && fill.quantity > 0) {
        fills.push(fill);
      }
    } catch (error) {
      console.error(`Error processing line ${i + 1}:`, error);
      continue;
    }
  }
  
  return fills;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function parseDasTraderDate(dateString: string): Date {
  // DAS Trader typically uses format like "02/15/2024 09:30:00"
  try {
    // Try common date formats
    const formats = [
      'MM/dd/yyyy HH:mm:ss',
      'MM/dd/yyyy h:mm:ss a',
      'yyyy-MM-dd HH:mm:ss',
      'MM/dd/yyyy',
      'yyyy-MM-dd'
    ];
    
    for (const format of formats) {
      try {
        const parsed = parse(dateString, format, new Date());
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      } catch {
        continue;
      }
    }
    
    // Fallback to native Date parsing
    return new Date(dateString);
  } catch (error) {
    console.error('Error parsing date:', dateString, error);
    return new Date();
  }
}

export function groupFillsIntoTrades(fills: ProcessedFill[]): Array<{
  symbol: string;
  fills: ProcessedFill[];
  status: 'OPEN' | 'CLOSED';
  side: 'BUY' | 'SELL';
  quantity: number;
  totalCommission: number;
}> {
  // Group fills by symbol
  const symbolGroups = new Map<string, ProcessedFill[]>();
  
  fills.forEach(fill => {
    if (!symbolGroups.has(fill.symbol)) {
      symbolGroups.set(fill.symbol, []);
    }
    symbolGroups.get(fill.symbol)!.push(fill);
  });
  
  // Sort fills by timestamp for each symbol
  symbolGroups.forEach(symbolFills => {
    symbolFills.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  });
  
  // Group into trades using FIFO logic
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
      const quantityChange = fill.side === 'BUY' ? fill.quantity : -fill.quantity;
      const newPosition = currentPosition + quantityChange;
      
      // If we have no current trade, start one
      if (currentTrade.length === 0) {
        currentTrade.push(fill);
        currentPosition = newPosition;
        continue;
      }
      
      // Check if this fill closes the current position
      const currentTradeSide = currentTrade[0].side;
      const oppositeSide = currentTradeSide === 'BUY' ? 'SELL' : 'BUY';
      
      if (fill.side === oppositeSide && Math.sign(currentPosition) !== Math.sign(newPosition)) {
        // This fill closes the trade
        currentTrade.push(fill);
        
        trades.push({
          symbol,
          fills: [...currentTrade],
          status: 'CLOSED',
          side: currentTradeSide,
          quantity: Math.abs(currentPosition),
          totalCommission: currentTrade.reduce((sum, f) => sum + f.commission, 0)
        });
        
        currentTrade = [];
        currentPosition = 0;
      } else {
        // This fill is part of the current trade
        currentTrade.push(fill);
        currentPosition = newPosition;
      }
    }
    
    // If there's an open trade left, add it
    if (currentTrade.length > 0) {
      trades.push({
        symbol,
        fills: currentTrade,
        status: 'OPEN',
        side: currentTrade[0].side,
        quantity: Math.abs(currentPosition),
        totalCommission: currentTrade.reduce((sum, f) => sum + f.commission, 0)
      });
    }
  });
  
  return trades;
}
