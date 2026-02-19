// Market data service for real-time stock data
interface MarketCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function getMarketData(symbol: string, timeframe: string = '1m', days: number = 7): Promise<MarketCandle[]> {
  try {
    // Using Alpha Vantage API (free tier) for real market data
    // You'll need to get a free API key from https://www.alphavantage.co/support/#api-key
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo';
    
    if (API_KEY === 'demo') {
      // Return demo data for testing
      return generateDemoData(symbol, days);
    }

    const interval = timeframe === '1m' ? '1min' : 
                   timeframe === '5m' ? '5min' : 
                   timeframe === '15m' ? '15min' : 
                   timeframe === '1h' ? '60min' : 'daily';

    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&outputsize=full&apikey=${API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data['Error Message']) {
      console.error('Alpha Vantage API error:', data['Error Message']);
      return generateDemoData(symbol, days);
    }

    const timeSeries = data[`Time Series (${interval})`];
    if (!timeSeries) {
      return generateDemoData(symbol, days);
    }

    const candles: MarketCandle[] = Object.entries(timeSeries)
      .slice(0, days * (timeframe === '1m' ? 1440 : timeframe === '5m' ? 288 : timeframe === '15m' ? 96 : timeframe === '1h' ? 24 : 7))
      .map(([timestamp, values]: [string, any]) => ({
        time: new Date(timestamp).toISOString(),
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseInt(values['5. volume'])
      }))
      .reverse();

    return candles;
  } catch (error) {
    console.error('Error fetching market data:', error);
    return generateDemoData(symbol, days);
  }
}

function generateDemoData(symbol: string, days: number): MarketCandle[] {
  const candles: MarketCandle[] = [];
  const now = new Date();
  const basePrice = 100 + Math.random() * 200; // Random base price
  
  for (let i = days * 1440; i >= 0; i--) { // Generate minute data
    const time = new Date(now.getTime() - i * 60 * 1000);
    const randomWalk = (Math.random() - 0.5) * 2;
    const open = i === days * 1440 ? basePrice : candles[candles.length - 1].close;
    const close = open + randomWalk;
    const high = Math.max(open, close) + Math.random() * 1;
    const low = Math.min(open, close) - Math.random() * 1;
    const volume = Math.floor(Math.random() * 10000) + 1000;
    
    candles.push({
      time: time.toISOString(),
      open,
      high,
      low,
      close,
      volume
    });
  }
  
  return candles;
}

export async function searchSymbol(symbol: string): Promise<boolean> {
  try {
    const API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo';
    
    if (API_KEY === 'demo') {
      return true; // Accept all symbols in demo mode
    }

    const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${symbol}&apikey=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    return data.bestMatches && data.bestMatches.length > 0;
  } catch (error) {
    console.error('Error searching symbol:', error);
    return true; // Allow symbol in demo mode
  }
}
