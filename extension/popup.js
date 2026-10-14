/** PDC Companion — popup logic: wallet status, address, balance. */
const PDC_DECIMALS = 12;

function atomicToHuman(v) {
  try {
    const n = BigInt(v);
    if (n === 0n) return '0';
    const whole = n / 10n ** BigInt(PDC_DECIMALS);
    const frac = (n % 10n ** BigInt(PDC_DECIMALS)).toString().padStart(PDC_DECIMALS, '0').replace(/0+$/, '');
    return whole.toString() + (frac ? `.${frac}` : '');
  } catch {
    return '0';
  }
}

function send(method, params) {
  return chrome.runtime.sendMessage({ pdcExtension: true, id: Date.now(), method, params });
}

(async () => {
  document.getElementById('ver').textContent = 'v' + chrome.runtime.getManifest().version;
  const statusEl = document.getElementById('status');
  try {
    const info = await send('pdc.getWalletInfo');
    if (info?.error) throw new Error(info.error.message);
    statusEl.innerHTML = '<span class="dot up"></span>Connected — ' + (info.result.network ?? 'mainnet');
    const addr = info.result.address;
    document.getElementById('addr').textContent = addr;
    document.getElementById('addrCard').style.display = 'block';
    const bal = await send('pdc.getBalance', {});
    if (!bal?.error) {
      document.getElementById('bal').textContent = atomicToHuman(bal.result.unlocked) + ' PDC';
      document.getElementById('balCard').style.display = 'block';
    }
  } catch (e) {
    statusEl.innerHTML = '<span class="dot down"></span>Wallet offline — start simplewallet with RPC on 19212';
  }
  document.getElementById('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
})();
