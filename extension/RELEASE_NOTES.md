# PDC Companion release notes

## 0.1.10

- **One-click Update:** popup **Update** downloads the published zip and, via
  the File System Access picker, writes it into the unpacked install folder,
  then reloads the extension. The folder is remembered for silent auto-apply
  on later versions when permission remains granted.
- Fallback: **Download zip** if the picker is unavailable or cancelled.

## 0.1.9

- **Update check:** popup compares the installed manifest version with the
  published latest signal (`trade.privacydatacoin.com/companion/latest.json`
  and `/api/companion/info`). When older, shows a clear banner with a
  download link.
- Canonical latest metadata lives in `extension/latest.json` (kept in sync
  with `manifest.json` via `npm run sync:companion-latest`).

## 0.1.8

- Popup **Balance (unlocked)** lists native PDC plus every whitelisted CA
  (e.g. BTCX) from wallet `getbalance` / `assets_whitelist_get`, with correct
  decimals (PDC 12, BTCX 8).

## 0.1.7

- Multi-wallet: popup shows an **Active wallet** dropdown when the Qt GUI
  has more than one wallet open (`mw_get_wallets` / `mw_select_wallet`).
- Switching the dropdown updates which wallet Companion / dApps use.

## 0.1.6

- Auto-approve `https://trade.privacydatacoin.com` in Approved dApps
  (install, update, and on first RPC config read).

## 0.1.5

- **Qt GUI Companion (port 19211):** JWT auth via `Pdc-Access-Token`
  (HS256 + `body_hash` / `salt` / `exp`) — paste Secret from Pdc Settings.
- Preset buttons for GUI 19211 vs simplewallet 19212; dedicated JWT secret field.

## 0.1.4

- Popup shows the **configured** RPC host:port (no more hardcoded “19212”).
- Clearer errors for HTTP 401 / unreachable; options hint: use simplewallet
  `19212`, not Qt GUI Companion JWT port `19211`.
- Settings: Test connection button; host permissions for all localhost ports.

## 0.1.3

- Fix stuck “Generating…”: stringify `BigInt` before `chrome.runtime.sendMessage`
  (JSON cannot serialize bigint → silent hang until timeout).

## 0.1.2

- Fix Ionic Swap generate: wrap RPC params as `{ proposal, destination_address }`
  (flat body left `fee_paid_by_a=0` → `WALLET_FEE_TOO_LOW` / stuck “Generating…”).

## 0.1.1

- Fix false “Wallet offline” when simplewallet is up: use PDC RPC names
  (`get_wallet_info`, `getaddress`, `getbalance`) instead of Zano aliases.
- Map `getbalance` → unlocked/locked for the popup.
- Fix content script wiring: inject page-world `window.pdcExtension` so Trade
  **Connect Wallet** can talk to the companion.

## 0.1.0

First public release of the PrivacyDataCoin wallet companion extension.

### Downloads

| File | For |
|---|---|
| `pdc-companion-extension-v0.1.0.zip` | Chrome / Edge / Brave — load unpacked via `chrome://extensions` |
| `pdc-companion-extension-v0.1.0-firefox-src.zip` | Firefox — `about:debugging` → Load Temporary Add-on (manifest.json) |
| `SHA256SUMS.txt` | Integrity verification |

### Highlights

- `window.pdcExtension` bridge protocol compatible with
  [`@privacydatacoin/pdc_web3`](https://github.com/PrivacyDataCoin-Project/pdc_web3)
  (`ExtensionBridge`, `detectExtension`, `connect`, swap proposal methods).
- Local wallet RPC relay (`simplewallet`, default `127.0.0.1:19212`) —
  keys never leave the wallet.
- Per-origin dApp approval: balance / transfer / Ionic Swap methods require
  explicit user approval; read-only info is public.
- Popup with wallet status, address, unlocked balance (PDC dark theme).
- Options page for RPC credentials and approved dApps management.

### Install

1. Unzip the download.
2. Chrome: `chrome://extensions` → Developer mode → **Load unpacked** →
   select the unzipped folder.
3. Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…**
   → select `manifest.json` inside the firefox src zip.
4. Start wallet RPC:
   `simplewallet --wallet-file … --rpc-bind-ip 127.0.0.1 --rpc-bind-port 19212`
5. Open Trade → approve `https://trade.privacydatacoin.com` in Companion Settings.