# My Trades

Trading journal application built with Next.js 14, TypeScript, TailwindCSS, Prisma, and PostgreSQL, including robust CSV validation for DAS Trader fills.

## Features

- Upload DAS Trader CSV files
- Process fills and automatically group them into trades
- Store trades and fills in PostgreSQL database
- Clean and professional UI with TailwindCSS

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Database**: PostgreSQL
- **ORM**: Prisma
- **File Processing**: Custom CSV parser with row-level validation

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database running

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
```

Update `DATABASE_URL` in `.env.local` with your PostgreSQL connection string.

3. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── upload/          # API endpoint for CSV upload
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
├── components/
│   └── CSVUploader.tsx      # CSV upload component
├── lib/
│   ├── csv-processor.ts     # CSV processing logic
│   └── prisma.ts            # Prisma client
├── types/
│   └── trading.ts           # TypeScript types
prisma/
└── schema.prisma            # Database schema
```

## Database Schema

The application uses two main models:

### Trade
- Stores grouped trade information
- Contains P&L, status (open/closed), dates, and commission

### Fill
- Stores individual fill/executions
- Linked to trades with foreign key relationship

## CSV Format

The application expects DAS Trader CSV exports with the following columns:
- Symbol
- Time/Date
- Side (BUY/SELL)
- Price
- Quantity
- Commission

## Usage

1. Export your fills from DAS Trader as a CSV file
2. Upload the CSV using the web interface
3. The system will automatically:
   - Parse the CSV data
   - Group fills into trades using FIFO logic
   - Calculate P&L for closed trades
   - Save everything to the database

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checks

### Database Commands

- `npx prisma studio` - Open Prisma Studio
- `npx prisma generate` - Generate Prisma client
- `npx prisma db push` - Push schema to database
- `npx prisma migrate dev` - Create and run migrations

## Future Features

- Dashboard with trade statistics
- Charts and analytics
- Trade editing capabilities
- Export functionality
- Multiple account support
