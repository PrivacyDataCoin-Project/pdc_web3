/**
 * PDC Companion — inpage script (runs in every page, document_start).
 *
 * Relays JSON-RPC style messages between the page (ExtensionBridge in
 * pdc_web3 / window.pdcExtension) and the extension background service
 * worker. Injects window.pdcExtension detection flag.
 *
 * Protocol (matches pdc_web3 ExtensionBridge):
 *   page -> extension:  { pdcExtension: true, id, method, params }
 *   extension -> page:  { pdcExtension: true, id, result } |
 *                       { pdcExtension: true, id, error: {message, code} } |
 *                       { pdcExtension: true, event, data }
 */
(() => {
  'use strict';

  if (window.__PDC_INPAGE__) return; // prevent double injection
  window.__PDC_INPAGE__ = true;

  const SOURCE_TAG = 'pdc-inpage';

  // Announce presence so ExtensionBridge.detectExtension() resolves quickly.
  window.postMessage({ pdcExtension: true, method: 'pdc.ping', source: SOURCE_TAG }, window.location.origin);

  window.addEventListener('message', (event) => {
    // Only accept same-origin messages (content script shares page origin).
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.pdcExtension !== true) return;
    if (msg.source === SOURCE_TAG) return; // ignore our own relayed frames

    // Page -> background: forward to the content-script port.
    if (msg.method) {
      chrome.runtime.sendMessage({ pdcExtension: true, ...msg }, (response) => {
        if (chrome.runtime.lastError) {
          window.postMessage(
            {
              pdcExtension: true,
              id: msg.id,
              error: { message: chrome.runtime.lastError.message, code: -32000 },
              source: SOURCE_TAG,
            },
            window.location.origin
          );
          return;
        }
        if (response) {
          window.postMessage({ ...response, source: SOURCE_TAG }, window.location.origin);
        }
      });
      return;
    }

    // Background push event relayed by content script is handled above via
    // sendMessage response; events are delivered by the content script as
    // window messages with source tag of the content script.
  });
})();
