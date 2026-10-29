/**
 * Wallet RPC methods that must not be proxied to a web origin.
 * dApps use sign_message / transfer / swaps; seed export stays on the wallet.
 */

export const BLOCKED_WALLET_METHODS = new Set([
  'get_seed_phrase_info',
  'get_restore_info',
  'get_seed_phrase',
  'export_wallet',
  'get_private_key',
  'get_private_keys',
]);

function coded(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/** @returns {string} trimmed method name safe to forward */
export function assertWalletMethodAllowed(method) {
  if (typeof method !== 'string') {
    throw coded(-32602, 'wallet method required');
  }
  const normalized = method.trim().toLowerCase();
  if (!normalized) {
    throw coded(-32602, 'wallet method required');
  }
  if (BLOCKED_WALLET_METHODS.has(normalized)) {
    throw coded(-32010, `wallet method ${normalized} is not exposed to dApps`);
  }
  return method.trim();
}
