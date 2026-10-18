/**
 * PDC Companion — content script (isolated world).
 *
 * 1. Injects inpage.js into the PAGE world (window.pdcExtension).
 * 2. Relays page postMessage ↔ background service worker.
 */
(() => {
  'use strict';

  // Inject page-world bridge
  try {
    const s = document.documentElement
      ? document.documentElement
      : document.head || document.documentElement;
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inpage.js');
    script.async = false;
    (document.documentElement || document.head).appendChild(script);
    script.remove();
  } catch {
    /* document not ready — rare at document_start */
  }

  // Trade site → reload after one-click file replace (unpacked install).
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data && data.type === 'PDC_COMPANION_REQUEST_RELOAD') {
      try {
        chrome.runtime.sendMessage({ type: 'PDC_COMPANION_RELOAD' }, () => {
          void chrome.runtime.lastError;
        });
      } catch {
        /* ignore */
      }
      return;
    }
  });

  // Page -> background
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.pdcExtension !== true || !msg.method) return;
    // Only relay frames tagged from inpage (ignore echoes / other scripts)
    if (msg.source !== 'pdc-inpage') return;

    try {
      chrome.runtime.sendMessage(
        { pdcExtension: true, id: msg.id, method: msg.method, params: msg.params },
        (response) => {
          if (chrome.runtime.lastError) {
            window.postMessage(
              {
                pdcExtension: true,
                id: msg.id,
                error: {
                  message: chrome.runtime.lastError.message || 'extension context unavailable',
                  code: -32001,
                },
              },
              window.location.origin
            );
            return;
          }
          if (response) {
            window.postMessage({ ...response }, window.location.origin);
          }
        }
      );
    } catch (e) {
      // e.g. BigInt in params → "Do not know how to serialize a BigInt"
      window.postMessage(
        {
          pdcExtension: true,
          id: msg.id,
          error: { message: e?.message || String(e), code: -32603 },
        },
        window.location.origin
      );
    }
  });

  // Background push events -> page
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.pdcExtension !== true || !msg.event) return;
    window.postMessage(
      { pdcExtension: true, event: msg.event, data: msg.data },
      window.location.origin
    );
  });

  // Wallet switch in popup writes pdcActiveAddress — relay as accountsChanged (no tabs permission).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.pdcActiveAddress) return;
    const next = changes.pdcActiveAddress.newValue;
    if (!next || typeof next !== 'string') return;
    window.postMessage(
      { pdcExtension: true, event: 'accountsChanged', data: [next] },
      window.location.origin
    );
  });
})();
