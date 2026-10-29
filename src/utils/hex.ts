/**
 * Hex encoding/decoding utilities for PDC
 * Used for transaction blobs, proposals, keys, etc.
 */

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  // parseInt('0g', 16) === 0 and parseInt('gg', 16) === NaN → Uint8Array stores 0.
  if (!/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array | ArrayBuffer, prefix = false): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let hex = '';
  for (const byte of view) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return prefix ? '0x' + hex : hex;
}

/**
 * Convert hex string to base64
 */
export function hexToBase64(hex: string): string {
  const bytes = hexToBytes(hex);
  return bytesToBase64(bytes);
}

/**
 * Convert Uint8Array to base64
 */
export function bytesToBase64(bytes: Uint8Array): string {
  // Use built-in btoa for browser, Buffer for Node
  if (typeof btoa !== 'undefined') {
    // Browser
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  } else {
    // Node.js
    return Buffer.from(bytes).toString('base64');
  }
}

/**
 * Convert base64 to Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
  if (typeof atob !== 'undefined') {
    // Browser
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } else {
    // Node.js
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }
}

/**
 * Convert base64 to hex
 */
export function base64ToHex(base64: string): string {
  return bytesToHex(base64ToBytes(base64));
}

/**
 * XOR two hex strings of equal length
 */
export function xorHex(a: string, b: string): string {
  const bytesA = hexToBytes(a);
  const bytesB = hexToBytes(b);
  if (bytesA.length !== bytesB.length) {
    throw new Error('Hex strings must have equal length for XOR');
  }
  const result = new Uint8Array(bytesA.length);
  for (let i = 0; i < bytesA.length; i++) {
    result[i] = bytesA[i]! ^ bytesB[i]!;
  }
  return bytesToHex(result);
}

/**
 * Check if string is valid hex
 */
export function isValidHex(hex: string): boolean {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length === 0) return false;
  if (clean.length % 2 !== 0) return false;
  return /^[0-9a-fA-F]+$/.test(clean);
}

/**
 * Normalize hex string (lowercase, no 0x prefix)
 */
export function normalizeHex(hex: string): string {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return clean.toLowerCase();
}

/**
 * Ensure hex string has 0x prefix
 */
export function ensureHexPrefix(hex: string): string {
  return hex.startsWith('0x') ? hex : '0x' + hex;
}

/**
 * Remove 0x prefix if present
 */
export function removeHexPrefix(hex: string): string {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}

/**
 * Pad hex string to specific byte length
 */
export function padHex(hex: string, byteLength: number): string {
  const clean = normalizeHex(hex);
  return clean.padStart(byteLength * 2, '0');
}

/**
 * Truncate hex string to specific byte length
 */
export function truncateHex(hex: string, byteLength: number): string {
  const clean = normalizeHex(hex);
  return clean.slice(0, byteLength * 2);
}

/**
 * Reverse hex string byte order (endianness conversion)
 */
export function reverseHexBytes(hex: string): string {
  const clean = normalizeHex(hex);
  if (clean.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  if (!/^[0-9a-f]*$/.test(clean)) {
    throw new Error('Invalid hex string');
  }
  const bytes = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(clean.slice(i, i + 2));
  }
  return bytes.reverse().join('');
}

/**
 * Generate random hex string (for testing)
 */
export function randomHex(byteLength: number): string {
  if (byteLength < 0) {
    throw new Error('randomHex: byteLength must be >= 0');
  }
  const bytes = new Uint8Array(byteLength);
  // Security: require a CSPRNG — never Math.random() (predictable = vulnerability).
  // 1) Global WebCrypto (browsers, Node 20+)
  // 2) node:crypto webcrypto (Node 18 — global crypto not yet unflagged there)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }
  // Defensive: no global WebCrypto. node:crypto fallback is handled by the
  // consumer (Node 20+ exposes global crypto unconditionally).
  /* v8 ignore next 5 */
  throw new Error(
    'randomHex: no CSPRNG available (crypto.getRandomValues missing). ' +
      'Use Node.js >= 20 or a browser with WebCrypto.'
  );
}

/**
 * Convert 32-byte key to hex (for asset IDs, spend keys, view keys)
 */
export function keyToHex(key: Uint8Array | string): string {
  if (typeof key === 'string') {
    return normalizeHex(key);
  }
  if (key.length !== 32) {
    throw new Error('Key must be 32 bytes');
  }
  return bytesToHex(key);
}

/**
 * Parse 32-byte key from hex
 */
export function hexToKey(hex: string): Uint8Array {
  const clean = normalizeHex(hex);
  if (clean.length !== 64) {
    throw new Error('Key hex must be 64 characters (32 bytes)');
  }
  return hexToBytes(clean);
}
