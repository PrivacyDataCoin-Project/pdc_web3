/** PDC Companion — popup logic: wallet status, address, multi-asset balance, multi-wallet pick. */
const DEFAULT_RPC = 'http://127.0.0.1:19212/json_rpc';
const NATIVE_ASSET_ID =
  'd6329b5b1f7c0805b5c345f4957554002a2f557845f64d7645dae0e051a6498a';

/** Decimals fallback when RPC omits decimal_point (PDC 12, BTCX 8). */
const DECIMALS_BY_ID = {
  [NATIVE_ASSET_ID]: 12,
  c2bf0410873b49ec7e7dd19d62bca9625d80cd3123670a67b48d997d3127426d: 8,
};

function atomicToHuman(v, decimals) {
  const dp = Number.isFinite(Number(decimals)) ? Number(decimals) : 12;
  try {
    const n = BigInt(v);
    if (n === 0n) return '0';
    const scale = 10n ** BigInt(dp);
    const whole = n / scale;
    const frac = (n % scale).toString().padStart(dp, '0').replace(/0+$/, '');
    return whole.toString() + (frac ? `.${frac}` : '');
  } catch {
    return '0';
  }
}

function send(method, params) {
  return chrome.runtime.sendMessage({ pdcExtension: true, id: Date.now(), method, params });
}

function shortRpc(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || (u.protocol === 'https:' ? '443' : '80')}`;
  } catch {
    return url;
  }
}

function shortAddr(addr) {
  if (!addr || addr.length < 16) return addr || '';
  return addr.slice(0, 8) + '…' + addr.slice(-6);
}

function decimalsFor(asset) {
  const id = String(asset?.asset_id ?? '').toLowerCase();
  if (Number.isFinite(Number(asset?.decimal_point))) return Number(asset.decimal_point);
  if (DECIMALS_BY_ID[id] !== undefined) return DECIMALS_BY_ID[id];
  return 12;
}

function renderBalances(assets) {
  const balEl = document.getElementById('bal');
  balEl.replaceChildren();
  if (!Array.isArray(assets) || assets.length === 0) {
    balEl.textContent = '—';
    return;
  }
  for (const a of assets) {
    const row = document.createElement('div');
    row.className = 'bal-row';
    const amt = document.createElement('span');
    amt.className = 'bal-amt';
    amt.textContent = atomicToHuman(a.unlocked, decimalsFor(a));
    const tick = document.createElement('span');
    tick.className = 'bal-ticker';
    tick.textContent = a.ticker || '???';
    tick.title = a.name || a.asset_id || '';
    row.appendChild(amt);
    row.appendChild(tick);
    balEl.appendChild(row);
  }
}

async function refreshBalanceAndAddress() {
  const info = await send('pdc.getWalletInfo');
  if (info?.error) throw new Error(info.error.message);
  const addr = info.result.address;
  document.getElementById('addr').textContent = addr;
  document.getElementById('addrCard').style.display = 'block';

  const assetsRes = await send('pdc.getAssets', {});
  if (!assetsRes?.error && Array.isArray(assetsRes.result) && assetsRes.result.length) {
    renderBalances(assetsRes.result);
    document.getElementById('balCard').style.display = 'block';
  } else {
    // Fallback: native-only getBalance (older SW / RPC without balances[]).
    const bal = await send('pdc.getBalance', {});
    if (!bal?.error) {
      renderBalances([
        {
          asset_id: NATIVE_ASSET_ID,
          ticker: 'PDC',
          decimal_point: 12,
          unlocked: bal.result.unlocked,
        },
      ]);
      document.getElementById('balCard').style.display = 'block';
    }
  }
  return info.result;
}

/** Semver-ish compare: a < b → negative, equal → 0, a > b → positive. */
function cmpVersion(a, b) {
  const pa = String(a || '')
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '')
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

const LATEST_URLS = [
  'https://trade.privacydatacoin.com/companion/latest.json',
  'https://trade.privacydatacoin.com/api/companion/info',
];

async function fetchLatestCompanion() {
  for (const url of LATEST_URLS) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.version) return data;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function checkForUpdate() {
  const banner = document.getElementById('updateBanner');
  const textEl = document.getElementById('updateText');
  const dl = document.getElementById('updateDownload');
  const applyBtn = document.getElementById('updateApply');
  const dismissBtn = document.getElementById('updateDismiss');
  if (!banner || !textEl || !dl) return;

  const installed = chrome.runtime.getManifest().version;
  let latestMeta;
  try {
    latestMeta = await fetchLatestCompanion();
  } catch {
    return;
  }
  if (!latestMeta?.version) return;
  if (cmpVersion(installed, latestMeta.version) >= 0) return;

  const { updateDismissedVersion } = await chrome.storage.local.get('updateDismissedVersion');
  if (updateDismissedVersion && cmpVersion(updateDismissedVersion, latestMeta.version) >= 0) {
    return;
  }

  let zipUrl =
    latestMeta.downloadUrl ||
    latestMeta.zipUrl ||
    'https://trade.privacydatacoin.com/api/companion/download';
  if (zipUrl.startsWith('/')) {
    zipUrl = `https://trade.privacydatacoin.com${zipUrl}`;
  }
  dl.href = zipUrl;

  const setStatus = (msg) => {
    textEl.textContent = msg;
  };

  // Best-effort silent replace when the unpacked folder was remembered earlier.
  const updater = window.PdcCompanionUpdate;
  if (updater?.tryAutoApplyUpdate) {
    try {
      const applied = await updater.tryAutoApplyUpdate(zipUrl, setStatus);
      if (applied) return;
    } catch {
      /* show banner + manual Update */
    }
  }

  textEl.textContent =
    `Installed v${installed} · latest v${latestMeta.version}. Press Update (pick unpacked folder once) — files replace and extension reloads. Or use Update on Trade.`;
  banner.style.display = 'block';

  if (applyBtn && updater?.applyCompanionUpdate) {
    applyBtn.onclick = async () => {
      applyBtn.disabled = true;
      try {
        const result = await updater.applyCompanionUpdate({
          zipUrl,
          allowPrompt: true,
          onStatus: setStatus,
        });
        if (result === 'downloaded') {
          setStatus(
            `Downloaded v${latestMeta.version}. Replace your unpacked folder contents, then click Reload on chrome://extensions.`
          );
        } else if (result === 'cancelled') {
          setStatus(
            `Installed v${installed} · latest v${latestMeta.version}. Update cancelled — press Update again or use Download zip.`
          );
        }
      } catch (e) {
        setStatus(`Update failed: ${e?.message || e}. Try Download zip.`);
      } finally {
        applyBtn.disabled = false;
      }
    };
  } else if (applyBtn) {
    applyBtn.onclick = () => {
      window.open(zipUrl, '_blank', 'noopener');
    };
  }

  dismissBtn?.addEventListener(
    'click',
    () => {
      void chrome.storage.local.set({ updateDismissedVersion: latestMeta.version });
      banner.style.display = 'none';
    },
    { once: true }
  );
}

async function loadWalletPicker(currentAddress) {
  const list = await send('pdc.getWallets');
  if (list?.error || !Array.isArray(list?.result?.wallets)) return;
  const wallets = list.result.wallets;
  if (wallets.length < 2) return;

  const card = document.getElementById('walletPickCard');
  const select = document.getElementById('walletSelect');
  select.innerHTML = '';
  let selectedId = null;
  for (const w of wallets) {
    const opt = document.createElement('option');
    opt.value = String(w.wallet_id);
    const label = (w.name && w.name.trim()) || shortAddr(w.address) || `Wallet #${w.wallet_id}`;
    opt.textContent = `${label} (#${w.wallet_id})`;
    if (currentAddress && w.address === currentAddress) {
      opt.selected = true;
      selectedId = w.wallet_id;
    }
    select.appendChild(opt);
  }
  if (selectedId === null && select.options.length) {
    select.options[0].selected = true;
  }
  card.style.display = 'block';

  select.addEventListener('change', async () => {
    const walletId = Number(select.value);
    const statusEl = document.getElementById('status');
    try {
      const res = await send('pdc.selectWallet', { wallet_id: walletId });
      if (res?.error) throw new Error(res.error.message);
      const info = await refreshBalanceAndAddress();
      statusEl.innerHTML =
        '<span class="dot up"></span>Connected — ' + (info.network ?? 'mainnet');
    } catch (e) {
      statusEl.innerHTML =
        '<span class="dot down"></span>Switch failed<br/><span style="font-size:0.72rem;color:#b7bdd6">' +
        String(e?.message || e).replace(/</g, '&lt;') +
        '</span>';
    }
  });
}

async function checkSecretRotationBanner() {
  const banner = document.getElementById('secretRotateBanner');
  const openBtn = document.getElementById('secretRotateOpen');
  const dismiss = document.getElementById('secretRotateDismiss');
  if (!banner) return;
  const { jwtSecretRotateRequired } = await chrome.storage.local.get('jwtSecretRotateRequired');
  if (!jwtSecretRotateRequired) {
    banner.style.display = 'none';
    return;
  }
  banner.style.display = 'block';
  openBtn?.addEventListener('click', () => chrome.runtime.openOptionsPage());
  dismiss?.addEventListener('click', async () => {
    await chrome.storage.local.set({ jwtSecretRotateRequired: false });
    banner.style.display = 'none';
  });
}

(async () => {
  document.getElementById('ver').textContent = 'v' + chrome.runtime.getManifest().version;
  const statusEl = document.getElementById('status');

  void checkForUpdate();
  void checkSecretRotationBanner();

  let rpcUrl = DEFAULT_RPC;
  try {
    const cfg = await send('pdc.getRpcConfig');
    if (cfg?.result?.rpcUrl) rpcUrl = cfg.result.rpcUrl;
  } catch {
    /* ignore — fall back to default for error text */
  }

  const rpcLabel = document.getElementById('rpcLabel');
  if (rpcLabel) rpcLabel.textContent = shortRpc(rpcUrl);

  try {
    const info = await refreshBalanceAndAddress();
    statusEl.innerHTML =
      '<span class="dot up"></span>Connected — ' + (info.network ?? 'mainnet');
    await loadWalletPicker(info.address);
  } catch (e) {
    const detail = e?.message ? String(e.message) : 'unreachable';
    statusEl.innerHTML =
      '<span class="dot down"></span>Wallet offline<br/><span style="font-size:0.72rem;color:#b7bdd6">' +
      detail.replace(/</g, '&lt;') +
      '</span>';
  }
  document.getElementById('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
})();
