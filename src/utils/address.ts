/**
 * Address utilities for PDC
 * Validation, formatting, and conversion
 */

import { PdcNetwork } from '../models/network';

// PDC address prefixes
export const PDC_ADDRESS_PREFIXES = {
  mainnet: 'pdc',
  testnet: 'tpdc',
  stagenet: 'spdc',
  regtest: 'rpdc'
} as const;

export type PdcAddressPrefix = typeof PDC_ADDRESS_PREFIXES[keyof typeof PDC_ADDRESS_PREFIXES];

/**
 * Validate PDC address format
 * Basic validation - full validation requires daemon RPC
 */
export function isValidPdcAddress(address: string, network?: PdcNetwork): boolean {
  if (!address || typeof address !== 'string') return false;
  
  // Check for alias format
  if (address.startsWith('@')) {
    return isValidAlias(address);
  }
  
  // Check prefix if network specified
  if (network) {
    const prefix = PDC_ADDRESS_PREFIXES[network];
    if (!address.startsWith(prefix)) return false;
  } else {
    // Check any known prefix
    const hasValidPrefix = Object.values(PDC_ADDRESS_PREFIXES).some(p => address.startsWith(p));
    if (!hasValidPrefix) return false;
  }
  
  // Basic length check (PDC addresses are ~106 chars base58)
  if (address.length < 90 || address.length > 110) return false;
  
  // Base58 character set validation
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(address);
}

/**
 * Validate alias format (@name)
 */
export function isValidAlias(alias: string): boolean {
  if (!alias || typeof alias !== 'string') return false;
  if (!alias.startsWith('@')) return false;
  
  const name = alias.slice(1);
  
  // Alias rules: 3-64 chars, lowercase alphanumeric, hyphen, underscore
  // Cannot start/end with hyphen/underscore
  if (name.length < 3 || name.length > 64) return false;
  if (!/^[a-z0-9][a-z0-9_-]*[a-z0-9]$/.test(name)) return false;
  if (name.startsWith('-') || name.startsWith('_') || name.endsWith('-') || name.endsWith('_')) return false;
  
  return true;
}

/**
 * Normalize alias (lowercase, ensure @ prefix)
 */
export function normalizeAlias(alias: string): string {
  const cleaned = alias.trim().toLowerCase();
  return cleaned.startsWith('@') ? cleaned : `@${cleaned}`;
}

/**
 * Extract alias name without @ prefix
 */
export function getAliasName(alias: string): string {
  return alias.startsWith('@') ? alias.slice(1) : alias;
}

/**
 * Get address prefix for network
 */
export function getAddressPrefix(network: PdcNetwork): PdcAddressPrefix {
  return PDC_ADDRESS_PREFIXES[network];
}

/**
 * Detect network from address prefix
 */
export function detectNetworkFromAddress(address: string): PdcNetwork | null {
  for (const [network, prefix] of Object.entries(PDC_ADDRESS_PREFIXES)) {
    if (address.startsWith(prefix)) {
      return network as PdcNetwork;
    }
  }
  return null;
}

/**
 * Format address for display (truncate middle)
 */
export function formatAddress(address: string, charsStart = 6, charsEnd = 6): string {
  if (address.length <= charsStart + charsEnd + 3) return address;
  return `${address.slice(0, charsStart)}...${address.slice(-charsEnd)}`;
}

/**
 * Validate integrated address (address + payment ID)
 */
export function isValidIntegratedAddress(address: string, network?: PdcNetwork): boolean {
  // Integrated addresses embed a payment ID, so they are longer than standard addresses
  // Note: network param reserved for future prefix-specific validation
  void network;
  if (!address || typeof address !== 'string') return false;
  if (address.length <= 110) return false; // must be longer than standard address
  // Integrated addresses are typically 140+ chars; allow up to 196
  if (address.length > 196) return false;
  // Base58 character set validation
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(address);
}

/**
 * Extract payment ID from integrated address (stub - needs daemon RPC)
 * In practice, use daemon RPC split_integrated_address
 */
export function extractPaymentIdFromIntegratedAddress(address: string): string | null {
  void address;
  // This requires daemon RPC call
  // Keeping as stub for API compatibility
  return null;
}

/**
 * Create integrated address (stub - needs daemon RPC)
 */
export function createIntegratedAddress(address: string, paymentId: string): string {
  void paymentId;
  // This requires daemon RPC call
  // Keeping as stub for API compatibility
  return address; // In reality, would call make_integrated_address RPC
}