/**
 * PDC Companion — inpage script (PAGE world).
 *
 * Injected by content.js into the host page. Exposes window.pdcExtension
 * (and window.PdcExtension) so Trade / dApps can connect without bundling
 * pdc_web3. Talks only via window.postMessage; content.js relays to the
 * background service worker.
 *
 * IMPORTANT: chrome.runtime.sendMessage JSON-encodes payloads and cannot
 * carry BigInt — we stringify all bigint values before leaving the page.
 */
(() => {
  'use strict';

  if (window.__PDC_INPAGE__) return;
  window.__PDC_INPAGE__ = true;

  const SOURCE = 'pdc-inpage';
  let nextId = 1;
  const pending = new Map();

  /** Deep-clone JSON-safe value; BigInt → decimal string. */
  function toJsonSafe(value) {
    if (typeof value === 'bigint') return value.toString();
    if (Array.isArray(value)) return value.map(toJsonSafe);
    if (value && typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = toJsonSafe(v);
      return out;
    }
    return value;
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.pdcExtension !== true) return;
    // Ignore our own outbound frames
    if (msg.source === SOURCE && msg.method) return;
    if (msg.id == null || !pending.has(msg.id)) return;
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(Object.assign(new Error(msg.error.message || 'extension error'), { code: msg.error.code }));
    else resolve(msg.result);
  });

  function call(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      try {
        window.postMessage(
          {
            pdcExtension: true,
            id,
            method,
            params: toJsonSafe(params ?? {}),
            source: SOURCE,
          },
          window.location.origin
        );
      } catch (e) {
        pending.delete(id);
        reject(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error('PDC Companion: request timed out'));
        }
      }, 60000);
    });
  }

  const bridge = {
    connect(req) {
      return call('pdc.getWalletInfo', req).then((info) => ({
        address: info.address,
        network: info.network ?? 'mainnet',
        isConnected: true,
        version: info.version,
      }));
    },
    getAddress() {
      return call('pdc.getAddress').then((r) => r.address);
    },
    getWalletInfo() {
      return call('pdc.getWalletInfo');
    },
    /** Installed Companion extension version (manifest). Works offline. */
    getVersion() {
      return call('pdc.ping').then((r) => r?.version ?? null);
    },
    ping() {
      return call('pdc.ping');
    },
    getBalance(params) {
      return call('pdc.getBalance', params);
    },
    signMessage(message) {
      // Wallet RPC expects { buff: base64 }. Accept raw string or { buff }.
      let params;
      if (typeof message === 'string') {
        const bytes = new TextEncoder().encode(message);
        let binary = '';
        for (const b of bytes) binary += String.fromCharCode(b);
        params = { buff: btoa(binary) };
      } else if (message && typeof message === 'object' && message.buff) {
        params = { buff: message.buff };
      } else {
        params = message;
      }
      return call('pdc.callWalletRpc', {
        method: 'sign_message',
        params,
      }).then((r) => ({
        signature: r?.sig ?? r?.signature ?? String(r ?? ''),
        // Spend public key hex — Trade auth must forward this as `pkey`.
        pkey: r?.pkey ?? '',
      }));
    },
    createSwapProposal(params) {
      return call('pdc.createSwapProposal', params);
    },
    getSwapProposalInfo(hex) {
      return call('pdc.getSwapProposalInfo', { hex_raw_proposal: hex });
    },
    acceptSwapProposal(hex) {
      return call('pdc.acceptSwapProposal', { hex_raw_proposal: hex });
    },
    callWalletRpc(method, params) {
      return call('pdc.callWalletRpc', { method, params });
    },
  };

  window.pdcExtension = bridge;
  window.PdcExtension = bridge;

  // Announce presence for detectExtension() / usePdcWallet
  window.postMessage({ pdcExtension: true, method: 'pdc.ping', source: SOURCE }, window.location.origin);
})();
