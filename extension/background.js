/**
 * PDC Companion — background service worker (MV3).
 *
 * Single source of truth for wallet state and RPC to the local simplewallet
 * HTTP endpoint (default http://127.0.0.1:19212/json_rpc). Origin pinning:
 * dApps must be explicitly allowed by the user (options page) before any
 * wallet method other than pdc.ping/pdc.getWalletInfo is served.
 *
 * Security notes:
 *  - No private keys ever leave the wallet; the extension is a relay + UI.
 *  - RPC credentials (rpc_login/rpc_password) are stored in chrome.storage
 *    (options page) and used only from this worker, never exposed to pages.
 *  - Requests from unapproved origins are rejected with code -32010.
 */
const DEFAULT_RPC = 'http://127.0.0.1:19212/json_rpc';

/** Methods safe to call without explicit origin approval. */
const SAFE_METHODS = new Set(['pdc.ping', 'pdc.getWalletInfo', 'pdc.getAddress']);

async function getConfig() {
  const { rpcUrl = DEFAULT_RPC, rpcLogin = '', rpcPassword = '', approvedOrigins = [] } =
    (await chrome.storage.local.get(['rpcUrl', 'rpcLogin', 'rpcPassword', 'approvedOrigins'])) ?? {};
  return { rpcUrl, rpcLogin, rpcPassword, approvedOrigins: approvedOrigins ?? [] };
}

let messageId = 0;

async function walletRpc(method, params) {
  const { rpcUrl, rpcLogin, rpcPassword } = await getConfig();
  const headers = { 'Content-Type': 'application/json' };
  if (rpcLogin) {
    headers['Authorization'] = 'Basic ' + btoa(rpcLogin + ':' + rpcPassword);
  }
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: ++messageId, method, params: params ?? {} }),
  });
  if (!res.ok) throw rpcError(-32002, `wallet RPC HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw rpcError(-32003, body.error.message ?? 'wallet RPC error', body.error);
  return body.result;
}

function rpcError(code, message, data) {
  return Object.assign(new Error(message), { code, data });
}

function isHex64(s) {
  return typeof s === 'string' && /^[0-9a-f]{64}$/i.test(s);
}

async function handle(method, params, origin) {
  const { approvedOrigins } = await getConfig();
  const approved = SAFE_METHODS.has(method) || approvedOrigins.includes(origin);

  switch (method) {
    case 'pdc.ping':
      return { pong: true, version: chrome.runtime.getManifest().version };

    case 'pdc.getWalletInfo': {
      const [status, addressRes] = await Promise.all([walletRpc('get_status'), walletRpc('get_address')]);
      return {
        address: addressRes.address,
        network: status.nettype ?? 'mainnet',
        isConnected: true,
        version: chrome.runtime.getManifest().version,
      };
    }

    case 'pdc.getAddress': {
      const r = await walletRpc('get_address');
      return { address: r.address };
    }

    case 'pdc.getBalance': {
      if (!approved) throw rpcError(-32010, `origin ${origin} is not approved for ${method}`);
      const assetId = params?.asset_id;
      if (assetId && !isHex64(assetId)) throw rpcError(-32602, 'asset_id must be a 64-char hex asset id');
      const r = await walletRpc('get_balance', assetId ? { asset_id: assetId } : {});
      return {
        unlocked: String(r.unlocked ?? r.total_unlocked ?? 0),
        locked: String(r.locked ?? r.total_locked ?? 0),
      };
    }

    case 'pdc.getAssets': {
      if (!approved) throw rpcError(-32010, `origin ${origin} is not approved for ${method}`);
      const r = await walletRpc('get_assets');
      const assets = Object.entries(r ?? {}).map(([asset_id, info]) => ({
        asset_id,
        name: info?.name ?? '',
        ticker: info?.ticker ?? '',
        decimal_point: info?.decimal_point ?? 12,
      }));
      return assets;
    }

    case 'pdc.transfer': {
      if (!approved) throw rpcError(-32010, `origin ${origin} is not approved for ${method}`);
      const r = await walletRpc('transfer', {
        destinations: [{ address: params.destination, amount: String(params.amount), asset_id: params.asset_id }],
        fee: params.fee ? String(params.fee) : undefined,
        mixin: params.mixin,
        payment_id: params.payment_id,
      });
      return { tx_hash: r.transaction_hash ?? r.tx_hash };
    }

    case 'pdc.createSwapProposal': {
      if (!approved) throw rpcError(-32010, `origin ${origin} is not approved for ${method}`);
      const r = await walletRpc('ionic_swap_generate_proposal', {
        to_finalizer: (params.to_finalizer ?? []).map((i) => ({ asset_id: i.asset_id, amount: String(i.amount) })),
        to_initiator: (params.to_initiator ?? []).map((i) => ({ asset_id: i.asset_id, amount: String(i.amount) })),
        fee_paid_by_a: String(params.fee_paid_by_a ?? 0),
        expiration_time: params.expiration_time,
        destination_address: params.destination_address,
      });
      return { hex_raw_proposal: r.hex_raw_proposal ?? r.raw_proposal };
    }

    case 'pdc.getSwapProposalInfo': {
      if (!approved) throw rpcError(-32010, `origin ${origin} is not approved for ${method}`);
      if (!isHex64(params?.hex_raw_proposal) && typeof params?.hex_raw_proposal !== 'string')
        throw rpcError(-32602, 'hex_raw_proposal required');
      const r = await walletRpc('ionic_swap_get_proposal_info', { hex_raw_proposal: params.hex_raw_proposal });
      return {
        to_finalizer: r.to_finalizer,
        to_initiator: r.to_initiator,
        fee_paid_by_a: r.fee_paid_by_a,
        expiration_time: r.expiration_time,
        proposer_address: r.proposer_address,
      };
    }

    case 'pdc.acceptSwapProposal': {
      if (!approved) throw rpcError(-32010, `origin ${origin} is not approved for ${method}`);
      const r = await walletRpc('ionic_swap_accept_proposal', { hex_raw_proposal: params.hex_raw_proposal });
      return { result_tx_id: r.result_tx_id ?? r.tx_id };
    }

    case 'pdc.callWalletRpc': {
      if (!approved) throw rpcError(-32010, `origin ${origin} is not approved for ${method}`);
      return walletRpc(params.method, params.params);
    }

    default:
      throw rpcError(-32601, `method ${method} not supported`);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.pdcExtension !== true || !msg.method) return;
  const origin = sender.origin ?? sender.url ?? 'unknown';
  (async () => {
    try {
      const result = await handle(msg.method, msg.params, origin);
      sendResponse({ pdcExtension: true, id: msg.id, result });
    } catch (err) {
      sendResponse({ pdcExtension: true, id: msg.id, error: { message: err.message, code: err.code ?? -32603 } });
    }
  })();
  return true; // async sendResponse
});

// Keep-alive for MV3 service worker longevity during active sessions.
chrome.alarms?.create('pdc-keepalive', { periodInMinutes: 4 });
chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pdc-keepalive') void walletRpc('get_status').catch(() => {});
});
