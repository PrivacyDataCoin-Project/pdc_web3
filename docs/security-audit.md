# pdc_web3 security audit

Status: **PARTIALLY COMPLETED**. High-confidence defects below are fixed and covered by the unit suite. Items that would change chain constants or wallet policy without a local chain are recorded and left unchanged.

Scope: this repository only (`src/` SDK, `extension/` PDC Companion, unit tests). No live wallet RPC, no mainnet node, and no host deploy.

Baseline before edits: `npx vitest run` — 264 tests passed.

## Architecture

```
dApp (page)
  │  window.postMessage  { pdcExtension, source:'pdc-inpage', id, method, params }
  ▼
extension/content.js          isolated world, <all_urls>, document_start
  │  chrome.runtime.sendMessage
  ▼
extension/background.js       MV3 service worker
  │  fetch JSON-RPC  (JWT Pdc-Access-Token or HTTP Basic)
  ▼
wallet RPC                    Qt Companion :19211 or simplewallet :19212
```

Parallel path, no extension: `WalletRpcClient` / `DaemonRpcClient` → `RpcClient` (axios JSON-RPC 2.0) → caller-supplied URL.

`extension/inpage.js` is injected into the page and exposes `window.pdcExtension` for sites that do not bundle the SDK. The SDK `ExtensionBridge` speaks the same postMessage channel. Request ids from the SDK are `sdk:N` so they do not collide with inpage's numeric ids.

Network presets live in `src/models/network.ts`. Amount helpers live in `src/utils/bigint.ts`. Address shape checks (not a base58 checksum) live in `src/utils/address.ts`.

### Trust boundaries

| Boundary                         | Trust                                             | Control                                                               |
| -------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| Page script ↔ content script     | Page origin is hostile until the user approves it | `source === 'pdc-inpage'`, then background origin allowlist           |
| Content script ↔ background      | Extension-internal                                | MV3 message sender                                                    |
| Background ↔ wallet RPC          | Localhost wallet holds keys                       | JWT body hash + salt, or Basic auth; secrets stay in `chrome.storage` |
| SDK axios client ↔ wallet/daemon | Caller-supplied URL                               | Response id must match the request                                    |
| Update zip → unpacked folder     | Allowlisted HTTPS hosts only                      | Path and uncompressed-size checks before write                        |

Approved origins default to `https://trade.privacydatacoin.com` and `https://matrix.privacydatacoin.com`. `pdc.ping`, `pdc.getWalletInfo`, `pdc.connect`, `pdc.disconnect`, `pdc.getAddress`, `pdc.getRpcConfig`, and `pdc.getWallets` do not require approval. Balance, transfer, swaps, and `pdc.callWalletRpc` do.

## Findings

| ID  | Sev.   | Status | Where                           | What                                                                                                                                                                                                                                                                                                 |
| --- | ------ | ------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | High   | Fixed  | `src/utils/hex.ts` `hexToBytes` | Non-hex digits were stored as `0` (`parseInt('gg', 16)` is `NaN`; `parseInt('0g', 16)` is `0`). Keys and blobs could be silently corrupted.                                                                                                                                                          |
| F2  | High   | Fixed  | `src/api/rpc-client.ts`         | Axios codes such as `ECONNABORTED` were `parseInt`'d to `NaN`, so `isTransportError()` was false for transport failures.                                                                                                                                                                             |
| F3  | High   | Fixed  | `RpcClient.batchCall`           | Results followed response order. JSON-RPC batch replies are not ordered. A swapped batch attached method B's result to method A. Missing ids were also accepted.                                                                                                                                     |
| F4  | High   | Fixed  | `RpcClient.call`                | A body whose `id` did not match the request was returned as success.                                                                                                                                                                                                                                 |
| F5  | High   | Fixed  | `RpcClient`                     | `JSON.stringify` throws on `bigint`. Transfer amounts never left the process. Bodies now encode `bigint` as decimal strings (same as Companion).                                                                                                                                                     |
| F6  | High   | Fixed  | `ExtensionBridge`               | Every `chrome-extension://` and `moz-extension://` origin was accepted, so pinning an id did not reject other extensions. An extension iframe could settle pending calls. Only listed origins are accepted. The page origin is always kept, because content.js posts replies with that origin.       |
| F7  | High   | Fixed  | `ExtensionBridge.sendMessage`   | `targetOrigin` was `TRUSTED_ORIGINS[0]`. A pinned extension origin does not match the page window, so `postMessage` dropped the request. Outbound target is always `window.location.origin`. Frames (`event.source !== window`) are ignored.                                                         |
| F8  | High   | Fixed  | SDK ↔ content.js                | Content.js relays only `source: 'pdc-inpage'`. The SDK omitted it, so bundled `ExtensionBridge` calls never reached the service worker. Outbound messages now set that source.                                                                                                                       |
| F9  | High   | Fixed  | `bigint` on the bridge          | `chrome.runtime.sendMessage` cannot carry `bigint`. Amounts failed in the content script. Params are decimal strings before `postMessage`.                                                                                                                                                           |
| F10 | High   | Fixed  | `ExtensionBridge.connect`       | The SDK called `pdc.connect`, which Companion did not implement (`-32601`). Connect now calls `pdc.getWalletInfo`. Companion also accepts `pdc.connect` / `pdc.disconnect` for older SDK builds. Empty results are not treated as a connected wallet.                                                |
| F11 | High   | Fixed  | `extension/content.js`          | Any site could post `PDC_COMPANION_REQUEST_RELOAD` and reload the extension (`<all_urls>`). Reload is limited to `https://trade.privacydatacoin.com` and `https://privacydatacoin.com`.                                                                                                              |
| F12 | High   | Fixed  | `pdc.callWalletRpc`             | Approved origins (Trade is pre-approved) could call `get_seed_phrase_info`, `get_restore_info`, and key-export names. Those methods are rejected with `-32010`.                                                                                                                                      |
| F13 | Medium | Fixed  | `messageOrigin`                 | Missing `sender.origin` fell back to the full `sender.url`, which never equals an origin allowlist. Extension URLs also need a manual origin: Node's `URL.origin` is the string `"null"` for `chrome-extension:`.                                                                                    |
| F14 | Medium | Fixed  | `extension/update-apply.js`     | Zip names containing `..`, empty segments, or a leading slash were passed to the directory picker. Deflate output whose length disagreed with the local header was kept. Both now throw before write.                                                                                                |
| F15 | Medium | Fixed  | `createIntegratedAddress`       | The helper returned the standard address and dropped `paymentId`. Callers now get an error and must use `WalletRpcClient.makeIntegratedAddress`. `extractPaymentIdFromIntegratedAddress` no longer returns `null` for every input.                                                                   |
| F16 | Medium | Fixed  | `humanToAtomic` / `parseAmount` | `1.2.3` kept `1.2` and ignored the rest. A ticker containing `(` threw `SyntaxError` or, for `.`, matched the wrong suffix. Extra dots throw. The ticker is escaped.                                                                                                                                 |
| F17 | Low    | Fixed  | `RpcClientError.isWalletError`  | Returned false for PDC wallet codes `-1001`…`-1013` (only the JSON-RPC `-32099`…`-32000` band matched).                                                                                                                                                                                              |
| F18 | Low    | Fixed  | `extension/options.js`          | Approved origins were stored as typed, including userinfo and host case. The saved value is `new URL(raw).origin` after the existing path check.                                                                                                                                                     |
| F19 | Low    | Fixed  | comments / README               | `1000000000n` was labeled 0.01 PDC. With 12 decimals it is 0.001 PDC. `dustThreshold` `100000000n` is 0.0001 PDC. Values were not changed.                                                                                                                                                           |
| F20 | High   | Open   | `getNativeAssetId`              | SDK native id is 64 zero bytes. Companion and the popup use `d6329b5b1f7c0805b5c345f4957554002a2f557845f64d7645dae0e051a6498a` and label it native PDC. Not changed: some wallet calls treat all-zero as "native" and others require the real id. Confirm on a wallet before switching the constant. |
| F21 | Medium | Open   | `defaultFee`                    | SDK default is `1000000000n` (0.001 PDC). Companion's swap fallback when the fee field is omitted is `10000000000` (0.01 PDC), specifically to avoid `WALLET_FEE_TOO_LOW`. The numeric constant was not changed.                                                                                     |
| F22 | Medium | Open   | `humanToAtomic`                 | Extra fractional digits are truncated (`1.123456789012345` at 12 decimals). Tests lock that behavior. A UI that shows the full string and then calls this helper will under-pay. Reject or round in the UI before calling it.                                                                        |
| F23 | Low    | Open   | `keyToHex(string)`              | A hex string is lowercased and returned even when it is not 32 bytes. Byte arrays are checked. Tests lock the string path.                                                                                                                                                                           |
| F24 | Medium | Open   | Companion method surface        | SDK methods for aliases, staking, marketplace, and daemon RPC have no `background.js` handler. They fail with `-32601`. Direct `WalletRpcClient` / `DaemonRpcClient` still speak those RPCs.                                                                                                         |
| F25 | Medium | Open   | postMessage relay               | A script running in an **approved** page can set `source: 'pdc-inpage'` and can answer the SDK's pending id before Companion does. Origin approval is the control. This relay cannot distinguish the extension from other same-window scripts.                                                       |
| F26 | Low    | Open   | ports                           | SDK wallet preset is `:19311`. Companion simplewallet default is `:19212`; Qt GUI Companion is `:19211`. Regtest reuses the mainnet daemon port `19211`. Presets were not changed.                                                                                                                   |
| F27 | Low    | Open   | `randomSalt`                    | JWT salt uses `byte % 62`, a small modulo bias. Not changed.                                                                                                                                                                                                                                         |
| F28 | Low    | Open   | zip CRC                         | Local-header CRC is not checked. Host allowlist plus the size check remain. Not changed without sample zips that would show false rejects.                                                                                                                                                           |

`pdc.callWalletRpc` is still a general proxy for approved origins, minus the seed/key denylist. A compromised approved origin can transfer and sign. That matches the current approval model; it is not a silent bug.

## Fixes (files)

- `src/api/rpc-client.ts` — bigint JSON, transport codes, response id, batch correlation, wallet error range
- `src/extension/extension-bridge.ts` — origin pin, page targetOrigin, inpage source, decimal amounts, `sdk:` ids, connect/disconnect, wallet payload check
- `src/utils/hex.ts`, `src/utils/bigint.ts`, `src/utils/address.ts`, `src/models/network.ts`
- `src/index.ts` — re-export `setTrustedOrigins`
- `extension/background.js`, `extension/secret-wallet-methods.mjs`, `extension/message-origin.mjs`
- `extension/content.js`, `extension/update-apply.js`, `extension/options.js`
- Tests listed under verification

## How to verify

```bash
npm ci
npx vitest run
npx vitest run --coverage
npx tsc --noEmit
npx eslint src --ext .ts
```

After these edits: **295 tests passed**. Coverage on `src/` is 100% statements, branches, functions, and lines. `tsc --noEmit` and `eslint src --ext .ts` passed.

Targeted checks:

- `hexToBytes('zz')` and `hexToBytes('0x0g')` throw `Invalid hex string`.
- `humanToAtomic('1.2.3', 12)` throws. `parseAmount('1 MTK(', 12, 'MTK(')` returns `1000000000000n`.
- `createIntegratedAddress('pdc1', 'pid')` throws and does not return `pdc1`.
- A batch whose replies are reversed still returns results in request order (`tests/rpc-clients.test.ts`).
- Axios code `ECONNABORTED` / `ERR_BAD_RESPONSE` becomes `-32603`.
- `assertWalletMethodAllowed('get_seed_phrase_info')` throws code `-32010`.
- `assertSafeZipPath('../manifest.json')` throws.
- Extension bridge tests reject `chrome-extension://not-pinned` and accept a pinned id plus the page origin.

Manual, with Companion loaded:

1. From a page that is not Trade or `https://privacydatacoin.com`, `postMessage({ type: 'PDC_COMPANION_REQUEST_RELOAD' })` must not reload the extension. From Trade it still may.
2. A bundled `ExtensionBridge.connect()` must resolve with the wallet address (method on the wire is `pdc.getWalletInfo`).
3. From an approved origin, `callWalletRpc('get_seed_phrase_info')` must fail. `getbalance` must still work.
4. Options: approving `HTTPS://Example.COM` stores `https://example.com`.

## Residual risk

The native asset id (F20) and the default fee (F21) can still send or price the wrong amount if callers trust the SDK constants. Do not treat this audit as manipulation-resistant signing: approved pages are fully trusted for transfer and swap, and the postMessage bridge cannot authenticate the extension against other scripts in the same window (F25).
