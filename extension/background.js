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
/** HTTP header expected by wallet_rpc_server (ZANO_ACCESS_TOKEN → Pdc-Access-Token). */
const PDC_ACCESS_TOKEN = 'Pdc-Access-Token';

/** Native PDC + known Trade whitelist CAs (decimals/ticker fallback if RPC omits them). */
const NATIVE_ASSET_ID =
  'd6329b5b1f7c0805b5c345f4957554002a2f557845f64d7645dae0e051a6498a';
const KNOWN_ASSETS = {
  [NATIVE_ASSET_ID]: {
    ticker: 'PDC',
    name: 'PrivacyDataCoin (Native)',
    decimal_point: 12,
  },
  // Wrapped Bitcoin CA — keep in sync with Trade/backend BTCX_ASSET_ID.
  c2bf0410873b49ec7e7dd19d62bca9625d80cd3123670a67b48d997d3127426d: {
    ticker: 'BTCX',
    name: 'Wrapped Bitcoin (BTCX)',
    decimal_point: 8,
  },
};

/** Always pre-approved so Trade works without a manual Settings step. */
const DEFAULT_APPROVED_ORIGINS = ['https://trade.privacydatacoin.com'];

/** Methods safe to call without explicit origin approval. */
const SAFE_METHODS = new Set([
  'pdc.ping',
  'pdc.getWalletInfo',
  'pdc.getAddress',
  'pdc.getRpcConfig',
  'pdc.getWallets',
]);

/** Ensure default dApps are in approvedOrigins (idempotent). */
async function ensureDefaultApprovedOrigins() {
  const { approvedOrigins = [] } = await chrome.storage.local.get('approvedOrigins');
  const list = Array.isArray(approvedOrigins) ? [...approvedOrigins] : [];
  let changed = false;
  for (const origin of DEFAULT_APPROVED_ORIGINS) {
    if (!list.includes(origin)) {
      list.push(origin);
      changed = true;
    }
  }
  if (changed) await chrome.storage.local.set({ approvedOrigins: list });
  return list;
}

async function getConfig() {
  await ensureDefaultApprovedOrigins();
  const {
    rpcUrl = DEFAULT_RPC,
    rpcLogin = '',
    rpcPassword = '',
    jwtSecret = '',
    approvedOrigins = [],
  } = (await chrome.storage.local.get([
    'rpcUrl',
    'rpcLogin',
    'rpcPassword',
    'jwtSecret',
    'approvedOrigins',
  ])) ?? {};
  return {
    rpcUrl,
    rpcLogin,
    rpcPassword,
    jwtSecret,
    approvedOrigins: approvedOrigins ?? [],
  };
}

let messageId = 0;

/** Standard base64 without padding (Zano JWT guide — not base64url). */
function b64nopad(bytesOrStr) {
  const bin =
    typeof bytesOrStr === 'string'
      ? btoa(unescape(encodeURIComponent(bytesOrStr)))
      : btoa(String.fromCharCode(...new Uint8Array(bytesOrStr)));
  return bin.replace(/=+$/g, '');
}

function randomSalt(len = 64) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => alphabet[b % alphabet.length]).join('');
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** HS256 JWT matching Zano Companion / docs.zano.org JWT guide. */
async function createAccessToken(httpBody, secret) {
  const header = b64nopad(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64nopad(
    JSON.stringify({
      body_hash: await sha256Hex(httpBody),
      user: 'pdc_extension',
      salt: randomSalt(64),
      exp: Math.floor(Date.now() / 1000) + 60,
    })
  );
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64nopad(sig)}`;
}

/**
 * Resolve JWT secret for GUI Companion (port 19211).
 * Prefer dedicated jwtSecret; fall back to password field when login empty
 * (users often paste the GUI Secret into the password box).
 */
function resolveJwtSecret(cfg) {
  if (cfg.jwtSecret && cfg.jwtSecret.trim()) return cfg.jwtSecret.trim();
  if (!cfg.rpcLogin && cfg.rpcPassword && /:19211\b/.test(cfg.rpcUrl)) {
    return cfg.rpcPassword;
  }
  return '';
}

async function walletRpc(method, params) {
  const cfg = await getConfig();
  const { rpcUrl, rpcLogin, rpcPassword } = cfg;
  const httpBody = JSON.stringify({
    jsonrpc: '2.0',
    id: ++messageId,
    method,
    params: params ?? {},
  });
  const headers = { 'Content-Type': 'application/json' };

  const jwtSecret = resolveJwtSecret(cfg);
  if (jwtSecret) {
    headers[PDC_ACCESS_TOKEN] = await createAccessToken(httpBody, jwtSecret);
  } else if (rpcLogin || rpcPassword) {
    // simplewallet --rpc-login user:pass
    headers['Authorization'] = 'Basic ' + btoa(`${rpcLogin}:${rpcPassword}`);
  }

  let res;
  try {
    res = await fetch(rpcUrl, { method: 'POST', headers, body: httpBody });
  } catch (e) {
    throw rpcError(
      -32002,
      `cannot reach ${rpcUrl} (${e?.message || 'network error'}) — is the wallet RPC running?`
    );
  }
  if (!res.ok) {
    let hint = '';
    if (res.status === 401) {
      hint = jwtSecret
        ? ' — JWT rejected (check GUI Companion Secret matches, and RPC is http://127.0.0.1:19211/json_rpc).'
        : ' — HTTP 401: for Qt GUI paste Companion Secret into “JWT secret” (port 19211). For simplewallet use 19212 + optional Basic login.';
    }
    throw rpcError(-32002, `wallet RPC HTTP ${res.status} at ${rpcUrl}${hint}`);
  }
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

function isExtensionOrigin(origin) {
  return (
    typeof origin === 'string' &&
    (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://'))
  );
}

function normalizeAssetId(id) {
  return typeof id === 'string' ? id.toLowerCase() : '';
}

function knownMeta(assetId) {
  return KNOWN_ASSETS[normalizeAssetId(assetId)] ?? null;
}

function lockedFrom(total, unlocked) {
  try {
    const locked = BigInt(String(total ?? 0)) - BigInt(String(unlocked ?? 0));
    return String(locked < 0n ? 0n : locked);
  } catch {
    return '0';
  }
}

/**
 * Build popup/dApp asset list: unlocked balances for native PDC + whitelisted CAs.
 * Prefer wallet getbalance.balances[]; merge assets_whitelist_get for zero-balance entries
 * and ticker/decimals; fall back to hardcoded Trade CA metadata (BTCX @ 8 dp, PDC @ 12).
 */
async function collectWhitelistedBalances() {
  const byId = new Map();

  const upsert = (rawId, partial) => {
    const assetId = normalizeAssetId(rawId);
    if (!assetId || !isHex64(assetId)) return;
    const known = knownMeta(assetId);
    const prev = byId.get(assetId);
    const ticker =
      (partial.ticker && String(partial.ticker).trim()) ||
      prev?.ticker ||
      known?.ticker ||
      assetId.slice(0, 6).toUpperCase();
    const name =
      (partial.name && String(partial.name).trim()) ||
      prev?.name ||
      known?.name ||
      ticker;
    const decimalRaw = partial.decimal_point ?? prev?.decimal_point ?? known?.decimal_point ?? 12;
    const decimal_point = Number(decimalRaw);
    const unlocked =
      partial.unlocked !== undefined
        ? String(partial.unlocked)
        : prev?.unlocked !== undefined
          ? prev.unlocked
          : '0';
    const locked =
      partial.locked !== undefined
        ? String(partial.locked)
        : prev?.locked !== undefined
          ? prev.locked
          : '0';
    byId.set(assetId, {
      asset_id: assetId,
      name,
      ticker,
      decimal_point: Number.isFinite(decimal_point) ? decimal_point : 12,
      unlocked,
      locked,
    });
  };

  const r = await walletRpc('getbalance', {});
  const list = Array.isArray(r.balances) ? r.balances : [];
  for (const b of list) {
    const assetId = b.asset_info?.asset_id ?? '';
    const unlocked = b.unlocked ?? 0;
    upsert(assetId, {
      name: b.asset_info?.full_name ?? b.asset_info?.name ?? '',
      ticker: b.asset_info?.ticker ?? '',
      decimal_point: b.asset_info?.decimal_point,
      unlocked: String(unlocked),
      locked: lockedFrom(b.total ?? 0, unlocked),
    });
  }

  // Native top-level fields when balances[] omitted native entry.
  if (!byId.has(NATIVE_ASSET_ID)) {
    const unlocked = r.unlocked_balance ?? r.unlocked ?? r.total_unlocked ?? 0;
    const total = r.balance ?? r.total ?? unlocked;
    upsert(NATIVE_ASSET_ID, {
      unlocked: String(unlocked),
      locked: lockedFrom(total, unlocked),
    });
  }

  try {
    const wl = await walletRpc('assets_whitelist_get', {});
    const pools = [
      ...(Array.isArray(wl?.local_whitelist) ? wl.local_whitelist : []),
      ...(Array.isArray(wl?.global_whitelist) ? wl.global_whitelist : []),
      ...(Array.isArray(wl?.own_assets) ? wl.own_assets : []),
    ];
    for (const a of pools) {
      const assetId = a?.asset_id ?? '';
      const key = normalizeAssetId(assetId);
      const prev = key ? byId.get(key) : null;
      upsert(assetId, {
        name: a?.full_name ?? a?.name ?? '',
        ticker: a?.ticker ?? '',
        decimal_point: a?.decimal_point,
        // Keep balance from getbalance; whitelist-only entries show 0 unlocked.
        unlocked: prev?.unlocked ?? '0',
        locked: prev?.locked ?? '0',
      });
    }
  } catch {
    // Whitelist RPC optional — getbalance alone covers active whitelisted balances.
  }

  // If wallet returned no CA rows but BTCX is a known Trade whitelist id, do not invent
  // a zero row — getbalance already lists only whitelisted assets when present.

  const assets = [...byId.values()];
  assets.sort((a, b) => {
    if (a.asset_id === NATIVE_ASSET_ID) return -1;
    if (b.asset_id === NATIVE_ASSET_ID) return 1;
    return String(a.ticker).localeCompare(String(b.ticker));
  });
  return assets;
}

async function handle(method, params, origin) {
  const { approvedOrigins } = await getConfig();
  // Popup / options pages are always trusted; dApps need explicit approval.
  const approved =
    SAFE_METHODS.has(method) || approvedOrigins.includes(origin) || isExtensionOrigin(origin);

  switch (method) {
    case 'pdc.ping':
      return { pong: true, version: chrome.runtime.getManifest().version };

    case 'pdc.getRpcConfig': {
      const cfg = await getConfig();
      return {
        rpcUrl: cfg.rpcUrl,
        rpcLogin: cfg.rpcLogin || null,
        hasPassword: Boolean(cfg.rpcPassword),
        hasJwtSecret: Boolean(resolveJwtSecret(cfg)),
        authMode: resolveJwtSecret(cfg) ? 'jwt' : cfg.rpcLogin || cfg.rpcPassword ? 'basic' : 'none',
      };
    }

    case 'pdc.getWalletInfo': {
      // PDC simplewallet uses get_wallet_info / getaddress (not Zano get_status / get_address)
      const info = await walletRpc('get_wallet_info');
      return {
        address: info.address,
        network: info.nettype ?? 'mainnet',
        height: info.current_height,
        isConnected: true,
        version: chrome.runtime.getManifest().version,
      };
    }

    case 'pdc.getAddress': {
      const r = await walletRpc('getaddress');
      return { address: r.address };
    }

    case 'pdc.getWallets': {
      // Multi-wallet API (Qt GUI Companion). simplewallet may return a single entry or error.
      try {
        const r = await walletRpc('mw_get_wallets');
        const wallets = Array.isArray(r?.wallets) ? r.wallets : [];
        return {
          wallets: wallets.map((w) => {
            const path = w.wi?.path ?? w.path ?? '';
            const fromPath = path.split(/[/\\]/).filter(Boolean).pop() || '';
            return {
              wallet_id: w.wallet_id,
              address: w.wi?.address ?? w.address ?? '',
              name: w.wi?.name ?? w.name ?? fromPath,
            };
          }),
        };
      } catch (e) {
        // Fallback: expose the currently active wallet only.
        const info = await walletRpc('get_wallet_info');
        const addr = await walletRpc('getaddress');
        return {
          wallets: [
            {
              wallet_id: 0,
              address: addr.address ?? info.address ?? '',
              name: info.name ?? '',
            },
          ],
        };
      }
    }

    case 'pdc.selectWallet': {
      // Popup / options only — switching active wallet for Companion RPC.
      if (!isExtensionOrigin(origin)) {
        throw rpcError(-32010, `origin ${origin} is not approved for ${method}`);
      }
      const walletId = params?.wallet_id;
      if (walletId === undefined || walletId === null || Number.isNaN(Number(walletId))) {
        throw rpcError(-32602, 'wallet_id required');
      }
      await walletRpc('mw_select_wallet', { wallet_id: Number(walletId) });
      // Notify open dApp tabs (via storage → content.js → postMessage accountsChanged).
      let address = '';
      try {
        const info = await walletRpc('get_wallet_info');
        address = info?.address ?? '';
        if (!address) {
          const a = await walletRpc('getaddress');
          address = a?.address ?? '';
        }
      } catch {
        /* best-effort */
      }
      if (address) {
        await chrome.storage.local.set({
          pdcActiveAddress: address,
          pdcActiveAddressTs: Date.now(),
        });
      }
      return { ok: true, wallet_id: Number(walletId), address };
    }

    case 'pdc.getBalance': {
      if (!approved) throw rpcError(-32010, `origin ${origin} is not approved for ${method}`);
      const assetId = params?.asset_id;
      if (assetId && !isHex64(assetId)) throw rpcError(-32602, 'asset_id must be a 64-char hex asset id');
      const r = await walletRpc('getbalance', assetId ? { asset_id: assetId } : {});
      const unlocked = r.unlocked_balance ?? r.unlocked ?? r.total_unlocked ?? 0;
      const total = r.balance ?? r.total ?? unlocked;
      const locked = BigInt(String(total)) - BigInt(String(unlocked));
      return {
        unlocked: String(unlocked),
        locked: String(locked < 0n ? 0n : locked),
      };
    }

    case 'pdc.getAssets': {
      if (!approved) throw rpcError(-32010, `origin ${origin} is not approved for ${method}`);
      // getbalance returns native + all whitelisted CA balances; enrich from assets_whitelist_get.
      return collectWhitelistedBalances();
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
      // PDC RPC shape: { proposal: { to_finalizer, to_initiator, fee_paid_by_a }, destination_address }
      // (flat fields leave fee=0 → API_RETURN_CODE_WALLET_FEE_TOO_LOW)
      const proposalIn = params.proposal ?? params;
      const dest = params.destination_address ?? proposalIn.destination_address;
      if (!dest) throw rpcError(-32602, 'destination_address required');
      const r = await walletRpc('ionic_swap_generate_proposal', {
        proposal: {
          to_finalizer: (proposalIn.to_finalizer ?? []).map((i) => ({
            asset_id: i.asset_id,
            amount: String(i.amount),
          })),
          to_initiator: (proposalIn.to_initiator ?? []).map((i) => ({
            asset_id: i.asset_id,
            amount: String(i.amount),
          })),
          fee_paid_by_a: String(proposalIn.fee_paid_by_a ?? 10000000000),
        },
        destination_address: dest,
      });
      return { hex_raw_proposal: r.hex_raw_proposal ?? r.raw_proposal };
    }

    case 'pdc.getSwapProposalInfo': {
      if (!approved) throw rpcError(-32010, `origin ${origin} is not approved for ${method}`);
      if (typeof params?.hex_raw_proposal !== 'string' || params.hex_raw_proposal.length < 20)
        throw rpcError(-32602, 'hex_raw_proposal required');
      const r = await walletRpc('ionic_swap_get_proposal_info', {
        hex_raw_proposal: params.hex_raw_proposal,
      });
      const p = r.proposal ?? r;
      return {
        to_finalizer: p.to_finalizer,
        to_initiator: p.to_initiator,
        fee_paid_by_a: p.fee_paid_by_a,
        expiration_time: p.expiration_time,
        proposer_address: p.proposer_address,
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
  if (msg && msg.type === 'PDC_COMPANION_RELOAD') {
    try {
      chrome.runtime.reload();
    } catch {
      /* ignore */
    }
    return;
  }
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

// Seed Trade as approved on install / update / SW start.
chrome.runtime.onInstalled.addListener(() => {
  void ensureDefaultApprovedOrigins();
});
void ensureDefaultApprovedOrigins();

// Keep-alive for MV3 service worker longevity during active sessions.
chrome.alarms?.create('pdc-keepalive', { periodInMinutes: 4 });
chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pdc-keepalive') void walletRpc('getaddress').catch(() => {});
});
