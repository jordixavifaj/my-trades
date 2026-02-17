'use client';

import { useState } from 'react';

interface UploadStats {
  totalFills: number;
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  skippedRows?: number;
}

interface UploadResponse {
  error?: string;
  stats?: UploadStats;
  validationErrors?: Array<{ line: number; reason: string }>;
}

export default function CSVUploader() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage('');
    setMessageType('info');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result: UploadResponse = await response.json();

      if (response.ok && result.stats) {
        const skippedText = result.stats.skippedRows ? `, skipped ${result.stats.skippedRows} invalid row(s)` : '';
        setMessage(
          `Success! Processed ${result.stats.totalFills} fills into ${result.stats.totalTrades} trades (${result.stats.closedTrades} closed, ${result.stats.openTrades} open${skippedText}).`,
        );
        setMessageType('success');
      } else {
        const validationHint = result.validationErrors?.[0]
          ? ` First issue: line ${result.validationErrors[0].line} - ${result.validationErrors[0].reason}.`
          : '';

        setMessage(`${result.error || 'Upload failed'}${validationHint}`);
        setMessageType('error');
      }
    } catch {
      setMessage('Upload failed. Please try again.');
      setMessageType('error');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Upload DAS Trader CSV</h2>

      <div className="mb-4">
        <label htmlFor="csv-upload" className="block text-sm font-medium text-gray-700 mb-2">
          Select CSV File
        </label>
        <input
          id="csv-upload"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileUpload}
          disabled={uploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
      </div>

      {uploading && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">Processing CSV file...</p>
        </div>
      )}

      {message && (
        <div
          className={`mb-4 p-3 rounded-md border ${
            messageType === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : messageType === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          <p className="text-sm">{message}</p>
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-md">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Instructions:</h3>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Export your fills from DAS Trader as CSV</li>
          <li>• The file must include: Symbol, Time/Date, Side, Price, Quantity (Commission optional)</li>
          <li>• Invalid rows are skipped and reported after upload</li>
          <li>• Trades are automatically saved to the database</li>
        </ul>
      </div>
    </div>
  );
}
