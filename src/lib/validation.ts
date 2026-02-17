export function parseNumber(value: unknown, field: string, options?: { min?: number }): number;
export function parseNumber(value: unknown, field: string, options?: { min?: number; allowNull?: false }): number;
export function parseNumber(value: unknown, field: string, options: { min?: number; allowNull: true }): number | null;
export function parseNumber(value: unknown, field: string, options?: { min?: number; allowNull?: boolean }) {
  if (value === null && options?.allowNull) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} debe ser un número válido`);
  if (options?.min !== undefined && parsed < options.min) throw new Error(`${field} debe ser >= ${options.min}`);
  return parsed;
}

export function parseInteger(value: unknown, field: string, options?: { min?: number }) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${field} debe ser un entero válido`);
  if (options?.min !== undefined && parsed < options.min) throw new Error(`${field} debe ser >= ${options.min}`);
  return parsed;
}

export function parseDate(value: unknown, field: string, options?: { allowNull?: false }): Date;
export function parseDate(value: unknown, field: string, options: { allowNull: true }): Date | null;
export function parseDate(value: unknown, field: string, options?: { allowNull?: boolean }) {
  if (value === null && options?.allowNull) return null;
  if (typeof value !== 'string' && !(value instanceof Date)) throw new Error(`${field} debe ser una fecha válida`);
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${field} debe ser una fecha válida`);
  return parsed;
}

export function parseString(value: unknown, field: string, options?: { minLength?: number; maxLength?: number }): string;
export function parseString(
  value: unknown,
  field: string,
  options: { minLength?: number; maxLength?: number; allowNull: true },
): string | null;
export function parseString(value: unknown, field: string, options?: { minLength?: number; maxLength?: number; allowNull?: boolean }) {
  if (value === null && options?.allowNull) return null;
  if (typeof value !== 'string') throw new Error(`${field} debe ser texto`);
  const parsed = value.trim();
  if (options?.minLength !== undefined && parsed.length < options.minLength) {
    throw new Error(`${field} requiere al menos ${options.minLength} caracteres`);
  }
  if (options?.maxLength !== undefined && parsed.length > options.maxLength) {
    throw new Error(`${field} no puede exceder ${options.maxLength} caracteres`);
  }
  return parsed;
}
