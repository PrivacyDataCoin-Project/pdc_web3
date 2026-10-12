/**
 * BigInt utilities for PDC
 * Handles serialization/deserialization of big integers for JSON-RPC
 */

// Convert bigint to string for JSON serialization
export function bigintToJson(value: bigint): string {
  return value.toString();
}

// Convert string from JSON to bigint
export function jsonToBigint(value: string | number): bigint {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`Number ${value} is not a safe integer`);
    }
    return BigInt(value);
  }
  return BigInt(value);
}

// Convert bigint to hex string (for RPC params that expect hex)
export function bigintToHex(value: bigint): string {
  if (value < 0) {
    throw new Error('Cannot convert negative bigint to hex');
  }
  return '0x' + value.toString(16).padStart(64, '0');
}

// Convert hex string to bigint
export function hexToBigint(hex: string): bigint {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return BigInt('0x' + clean);
}

// Convert atomic units to human-readable string
export function atomicToHuman(
  atomic: bigint,
  decimalPoint: number,
  options?: { trimTrailingZeros?: boolean; maxDecimals?: number }
): string {
  const negative = atomic < 0;
  const abs = negative ? -atomic : atomic;
  const divisor = 10n ** BigInt(decimalPoint);

  const whole = abs / divisor;
  const fraction = abs % divisor;

  let fractionStr = fraction.toString().padStart(decimalPoint, '0');

  if (options?.trimTrailingZeros !== false) {
    fractionStr = fractionStr.replace(/0+$/, '');
  }

  if (options?.maxDecimals !== undefined && fractionStr.length > options.maxDecimals) {
    fractionStr = fractionStr.slice(0, options.maxDecimals);
  }

  const result = fractionStr ? `${whole}.${fractionStr}` : whole.toString();

  return negative ? `-${result}` : result;
}

// Convert human-readable string to atomic units
export function humanToAtomic(human: string, decimalPoint: number): bigint {
  const negative = human.startsWith('-');
  const clean = negative ? human.slice(1) : human;

  const [whole, fraction = ''] = clean.split('.');
  const paddedFraction = fraction.padEnd(decimalPoint, '0').slice(0, decimalPoint);

  const wholePart = BigInt(whole || '0') * 10n ** BigInt(decimalPoint);
  const fractionPart = BigInt(paddedFraction || '0');

  return negative ? -(wholePart + fractionPart) : wholePart + fractionPart;
}

// Format with ticker
export function formatAmount(
  atomic: bigint,
  decimalPoint: number,
  ticker: string,
  options?: { trimTrailingZeros?: boolean; maxDecimals?: number }
): string {
  return `${atomicToHuman(atomic, decimalPoint, options)} ${ticker}`;
}

// Parse amount with ticker
export function parseAmount(input: string, decimalPoint: number, ticker: string): bigint {
  const clean = input.replace(new RegExp(`\\s*${ticker}\\s*$`, 'i'), '').trim();
  return humanToAtomic(clean, decimalPoint);
}
