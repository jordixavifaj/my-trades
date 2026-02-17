import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'My Trades',
  description: 'Trading journal application',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
