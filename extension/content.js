/**
 * PDC Companion — content script.
 *
 * Bridges between the inpage script (page context) and the background
 * service worker:
 *   inpage (page ctx) --window.postMessage--> here (isolated ctx)
 *   here --chrome.runtime.sendMessage--> background (service worker)
 *
 * Background events are pushed to all tabs and re-posted into the page.
 */
(() => {
  'use strict';

  // Relay page -> background
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.pdcExtension !== true) return;
    if (msg.source === 'pdc-inpage') return; // our own echoes

    if (msg.method) {
      chrome.runtime.sendMessage({ pdcExtension: true, ...msg }).catch(() => {
        // Service worker unavailable — report as internal error.
        window.postMessage(
          { pdcExtension: true, id: msg.id, error: { message: 'PDC Companion: extension context unavailable', code: -32001 } },
          window.location.origin
        );
      });
    }
  });

  // Relay background events -> page
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.pdcExtension !== true || !msg.event) return;
    window.postMessage({ pdcExtension: true, event: msg.event, data: msg.data }, window.location.origin);
  });

  // Let the page know the extension is installed (ping/pong handshake).
  window.postMessage({ pdcExtension: true, method: 'pdc.ping', source: 'pdc-content' }, window.location.origin);
})();
