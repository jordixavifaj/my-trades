export function logInfo(message: string, context?: Record<string, unknown>) {
  console.info(`[info] ${message}`, context ?? {});
}

export function logError(message: string, error: unknown, context?: Record<string, unknown>) {
  console.error(`[error] ${message}`, {
    ...(context ?? {}),
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
  });
}
