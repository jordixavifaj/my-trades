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
        const skippedText = result.stats.skippedRows ? `, ${result.stats.skippedRows} fila(s) inválidas omitidas` : '';
        setMessage(
          `Importación completada: ${result.stats.totalFills} fills en ${result.stats.totalTrades} trades (${result.stats.closedTrades} cerrados, ${result.stats.openTrades} abiertos${skippedText}).`,
        );
        setMessageType('success');
      } else {
        const validationHint = result.validationErrors?.[0]
          ? ` Primer error: línea ${result.validationErrors[0].line} - ${result.validationErrors[0].reason}.`
          : '';

        setMessage(`${result.error || 'Upload failed'}${validationHint}`);
        setMessageType('error');
      }
    } catch {
      setMessage('No se pudo subir el archivo. Inténtalo de nuevo.');
      setMessageType('error');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="panel mx-auto w-full p-6">
      <h2 className="mb-4 text-2xl font-semibold tracking-tight">Importación DAS Trader</h2>

      <div className="mb-4">
        <label htmlFor="csv-upload" className="mb-2 block text-sm font-medium text-slate-300">
          Selecciona CSV/XLS/XLSX
        </label>
        <input
          id="csv-upload"
          type="file"
          accept=".csv,.xls,.xlsx"
          onChange={handleFileUpload}
          disabled={uploading}
          className="block w-full text-sm text-slate-400 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-500/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-cyan-100 hover:file:bg-cyan-500/30 disabled:opacity-50"
        />
      </div>

      {uploading && (
        <div className="mb-4 rounded-md border border-cyan-700 bg-cyan-950 p-3">
          <p className="text-sm text-cyan-200">Procesando archivo...</p>
        </div>
      )}

      {message && (
        <div
          className={`mb-4 rounded-md border p-3 ${
            messageType === 'success'
              ? 'border-emerald-700 bg-emerald-950 text-emerald-300'
              : messageType === 'error'
                ? 'border-rose-700 bg-rose-950 text-rose-300'
                : 'border-cyan-700 bg-cyan-950 text-cyan-300'
          }`}
        >
          <p className="text-sm">{message}</p>
        </div>
      )}
    </div>
  );
}
