# PDC Companion release notes

## 0.1.21

- **Stable 10-minute Companion session:** pasted JWT secret is **kept across
  sign / Trade actions** while the Qt wallet Companion RPC responds (no
  per-action wipe). Cleared only after **10 minutes offline**.
- **JWT access-token `exp`:** **10 minutes** (aligned with wallet salt window).
- **UI copy:** Options / popup no longer claim a forced 10-minute secret wipe
  while the wallet is online.

## 0.1.20

- **Fail-closed hardening:** reject invalid hex silently becoming zeros; correlate
  JSON-RPC batch replies by id; pin ExtensionBridge to the page origin; block
  seed/key export via `pdc.callWalletRpc`; reject zip-slip and inflated-size
  mismatch on Companion update; limit extension reload to Trade / site origins.
- **SDK defaults:** `defaultFee` aligned with PDC/Zano `TX_DEFAULT_FEE`
  (`10000000000` = **0.01 PDC**); `dustThreshold` = `0`.
- **Bridge:** `pdc.connect` / `pdc.disconnect` aliases; bigint params as decimal
  strings; origin allowlist no longer accepts every `chrome-extension://` id.

## 0.1.19

- **Fix `getBalance(asset_id)` for CAs:** read unlocked/locked from
  `getbalance.balances[]` for the requested asset id. Top-level
  `unlocked_balance` is native PDC only — older builds returned that for
  every CA, so Trade showed ~PDC×1000 as “Available ARQX”.
- **Expose `getAssets()`** on the inpage bridge (same rows as the popup).
- Trade can prefer `getAssets` when present; update Companion to **0.1.19**.

## 0.1.18

- **Matrix claim origin:** pre-approve only `https://matrix.privacydatacoin.com`
  (web UI + claim). Remove mistaken `messenger.privacydatacoin.com` (no DNS).
  Reload the extension / re-open Options once so stored Approved dApps update.

## 0.1.17

- **Session persistence:** while the Qt wallet Companion RPC responds, the
  stored JWT secret is **kept** (no more forced wipe every 10 minutes from
  0.1.15–0.1.16). Connection stays up for as long as the wallet is on.
- **Keepalive:** wallet probe every **1 minute**; cancels any offline-clear
  timer when RPC succeeds.
- **Idle cleanup only when offline:** if wallet RPC stays unreachable for
  **60 minutes** (Companion OFF / wallet closed), the stored secret is
  cleared and a notification asks you to paste it again when reconnecting.
- **JWT access-token `exp`:** **30 minutes** (fresh token still minted on
  every RPC call; must stay below the wallet 1h salt window).
- **Matrix claim:** pre-approve `https://matrix.privacydatacoin.com` so
  **Sign with Companion** can call `sign_message` without a manual Approved
  dApps step. (0.1.18 drops the incorrect messenger host.)

## 0.1.16

- **Update security:** auto-apply / download zip URLs must be `https` on
  allowlisted hosts only (`trade.privacydatacoin.com`, `github.com`,
  `objects.githubusercontent.com`). Arbitrary absolute `zipUrl` values are rejected.

## 0.1.15

- **JWT lifetime:** access-token `exp` is **10 minutes** (was 60s).
- **Secret rotation:** 10 minutes after saving a Companion JWT secret, the
  extension clears it and shows a system notification that a **new key is
  required for security** — regenerate in Qt Settings → Pdc Companion and
  paste into Options again. (**Superseded in 0.1.17** — wipe only after
  prolonged wallet offline, not on a timer while the wallet is up.)

## 0.1.14

- **acceptSwapProposal:** require `hex_raw_proposal`, validate 64-hex
  `result_tx_id`, and surface actionable errors when wallet RPC drops
  (JWT/Companion GUI crash) instead of a bare network failure.

## 0.1.13

- **Wallet switch → dApps:** after popup Active wallet change, Companion
  publishes `accountsChanged` so Trade re-reads the active address (Take with
  a second wallet no longer stuck on the maker JWT identity).

## 0.1.12

- **Trade one-click Replace:** Trade banner **Replace extension** writes the
  published zip into the unpacked Companion folder (not zip-only download).
- After replace, Trade asks the content script to `chrome.runtime.reload()` so
  the new build loads without a manual Reload when possible.
- Silent auto-apply on Trade when the folder handle permission remains granted.

## 0.1.11

- Bridge for Trade-driven reload after file replace (`PDC_COMPANION_RELOAD`).

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