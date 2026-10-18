# PDC Companion — Browser Extension

Wallet companion extension for PrivacyDataCoin (Manifest V3). Connects dApps
(like [PDC Trade](https://trade.privacydatacoin.com)) to a local PDC wallet
via `simplewallet` JSON-RPC, implements the `window.pdcExtension` bridge
protocol compatible with [`@privacydatacoin/pdc_web3`](../README.md)
(`ExtensionBridge`).

## Features

- **dApp connection bridge** — content script + inpage relay implementing the
  `pdcExtension` postMessage protocol (ping/pong handshake, JSON-RPC style
  request/response, push events).
- **Wallet RPC relay** — talks to local `simplewallet` HTTP RPC
  (default `http://127.0.0.1:19212/json_rpc`) using PDC method names
  (`getaddress`, `getbalance`, `get_wallet_info`, `ionic_swap_*`).
  Credentials stay local.
- **Origin pinning** — only explicitly approved dApp origins may call
  balance / transfer / swap methods. Read-only info methods (`pdc.ping`,
  `pdc.getWalletInfo`, `pdc.getAddress`) work everywhere.
- **Ionic Swaps** — `pdc.createSwapProposal`, `pdc.getSwapProposalInfo`,
  `pdc.acceptSwapProposal` mapped to the native wallet RPC methods
  (`ionic_swap_generate_proposal`, `ionic_swap_get_proposal_info`,
  `ionic_swap_accept_proposal`).
- **Popup UI** — wallet status, address, unlocked balances for native PDC and
  whitelisted assets such as BTCX (explorer dark theme).
- **Multi-wallet** — when connected to the Qt GUI Companion (port 19211) with
  several wallets open, the popup can switch the active wallet
  (`mw_get_wallets` / `mw_select_wallet`). The GUI also syncs the sidebar
  selection to Companion automatically.
- **Options page** — RPC endpoint/credentials management + approved dApps list.

## Security model

- The extension never holds or transmits private keys — it relays
  signed operations to the local wallet daemon.
- RPC credentials are stored in `chrome.storage.local` and used **only** inside
  the background service worker; they are never exposed to web pages.
- All page-facing requests are filtered by origin; unapproved origins receive
  error code `-32010`.
- `inpage.js` is exposed via `web_accessible_resources` but only opens the
  message relay; it does not grant any authority by itself.

## Install (development)

1. Build icons (see `icons/`) and pack: `zip -r pdc-companion.zip . -x '*.md'`
2. Chrome/Edge/Brave: `chrome://extensions` → enable **Developer mode** →
   **Load unpacked** → select this folder.
3. Start the local wallet with RPC enabled:
   `simplewallet --wallet-file ... --rpc-bind-port 19212 --rpc-login user:pass`
4. Open the popup → Settings → set RPC login/password if used.

## dApp integration

```ts
import { ExtensionBridge } from '@privacydatacoin/pdc_web3';

const bridge = new ExtensionBridge();
const info = await bridge.connect({
  appName: 'PDC Trade',
  appUrl: location.origin,
  requiredPermissions: ['wallet.connect', 'wallet.sign', 'wallet.swap'],
});
const { hex_raw_proposal } = await bridge.createSwapProposal({ /* ... */ });
```

## Version / update signal

1. Bump `extension/manifest.json` → `"version"`.
2. Run `npm run sync:companion-latest` (writes `extension/latest.json`).
3. Mirror that JSON to Trade FE `public/companion/latest.json` and deploy FE
   so `https://trade.privacydatacoin.com/companion/latest.json` (and
   `/api/companion/info`) advertise the new version.
4. Tag `extension-vX.Y.Z` for the GitHub zip assets used by the download proxy.

The popup (and Trade) compare the installed manifest version against that
published signal and show an update banner when older.

## Build & release

CI (`.github/workflows/extension-release.yml`) packs `extension/` into
`pdc-companion-vX.Y.Z.zip` and attaches it to a GitHub Release on tag
`extension-v*`. Firefox: load via `web-ext run --source-dir extension/`
(temporary add-on) — a signed AMO build can be produced with
`web-ext sign` once listed.

## License

MIT — see repository root.
