export interface ProcessedFill {
  symbol: string;
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  timestamp: Date;
  commission: number;
}

export interface Trade {
  id: string;
  symbol: string;
  status: 'OPEN' | 'CLOSED';
  openDate: Date;
  closeDate?: Date;
  openPrice: number;
  closePrice?: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  pnl?: number;
  commission: number;
  strategy?: {
    id: string;
    name: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  fills: ProcessedFill[];
}

export interface CSVProcessingError {
  line: number;
  reason: string;
}

export interface CSVProcessingResult {
  fills: ProcessedFill[];
  errors: CSVProcessingError[];
}
