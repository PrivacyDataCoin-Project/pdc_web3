/**
 * Best-effort in-place update for an unpacked PDC Companion install.
 *
 * Flow: fetch zip → (optional) File System Access write into the loaded folder
 * → chrome.runtime.reload(). Falls back to opening the zip download URL when
 * the directory picker is unavailable or the user cancels.
 *
 * Directory handles are remembered in IndexedDB so later updates can auto-apply
 * without prompting when permission is still granted.
 */
const HANDLE_DB = 'pdc-companion-update';
const HANDLE_STORE = 'handles';
const HANDLE_KEY = 'installDir';

function openHandleDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('indexedDB open failed'));
  });
}

async function storeDirHandle(handle) {
  const db = await openHandleDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('indexedDB put failed'));
  });
  db.close();
}

async function loadDirHandle() {
  try {
    const db = await openHandleDb();
    const handle = await new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, 'readonly');
      const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('indexedDB get failed'));
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

async function ensureWritePermission(handle, { prompt } = { prompt: false }) {
  if (!handle) return false;
  const opts = { mode: 'readwrite' };
  try {
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if (!prompt) return false;
    return (await handle.requestPermission(opts)) === 'granted';
  } catch {
    return false;
  }
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Deflate not supported in this browser');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Minimal ZIP reader (store + deflate). Returns Map<path, Uint8Array>.
 * Skips directories and junk (e.g. __MACOSX).
 */
async function readZipEntries(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const out = new Map();
  let offset = 0;

  while (offset + 30 <= data.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break;

    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    let compSize = view.getUint32(offset + 18, true);
    let uncompSize = view.getUint32(offset + 22, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const nameBytes = data.subarray(nameStart, nameStart + nameLen);
    const name = new TextDecoder('utf-8').decode(nameBytes);
    let dataStart = nameStart + nameLen + extraLen;

    if (flags & 0x08) {
      // Data descriptor after payload — scan for next local header / descriptor.
      // Prefer sizes from central directory when present; for Companion zips
      // sizes are normally in the local header (bit 3 unset).
      throw new Error('ZIP data descriptor unsupported — use a standard Companion zip');
    }

    const comp = data.subarray(dataStart, dataStart + compSize);
    offset = dataStart + compSize;

    if (name.endsWith('/') || name.includes('__MACOSX') || name.endsWith('.DS_Store')) {
      continue;
    }

    let payload;
    if (method === 0) {
      payload = comp.slice();
    } else if (method === 8) {
      payload = await inflateRaw(comp);
      if (uncompSize && payload.length !== uncompSize) {
        /* tolerate minor mismatch */
      }
    } else {
      throw new Error(`Unsupported ZIP method ${method} for ${name}`);
    }
    out.set(name.replace(/^(\.\/)+/, ''), payload);
  }

  if (!out.size) throw new Error('ZIP contained no files');
  return out;
}

/** Strip a single shared top-level folder (e.g. pdc-companion-v0.1.10/). */
function stripCommonRoot(entries) {
  const keys = [...entries.keys()];
  const first = keys[0];
  const slash = first.indexOf('/');
  if (slash <= 0) return entries;
  const root = first.slice(0, slash + 1);
  if (!keys.every((k) => k.startsWith(root))) return entries;
  const next = new Map();
  for (const [k, v] of entries) {
    next.set(k.slice(root.length), v);
  }
  return next;
}

async function writeEntry(rootDir, relPath, bytes) {
  const parts = relPath.split('/').filter(Boolean);
  if (!parts.length) return;
  let dir = rootDir;
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i], { create: true });
  }
  const file = await dir.getFileHandle(parts[parts.length - 1], { create: true });
  const writable = await file.createWritable();
  await writable.write(bytes);
  await writable.close();
}

async function verifyCompanionFolder(dir) {
  try {
    const fh = await dir.getFileHandle('manifest.json');
    const file = await fh.getFile();
    const text = await file.text();
    const manifest = JSON.parse(text);
    const name = String(manifest.name || '');
    if (!/PDC Companion/i.test(name)) {
      throw new Error('Selected folder is not PDC Companion (manifest name mismatch)');
    }
    return true;
  } catch (e) {
    if (e && e.message && /manifest name/.test(e.message)) throw e;
    throw new Error('Select the unpacked PDC Companion folder (must contain manifest.json)');
  }
}

async function pickCompanionDir() {
  if (typeof window.showDirectoryPicker !== 'function') {
    throw new Error('Directory picker unavailable');
  }
  const dir = await window.showDirectoryPicker({
    id: 'pdc-companion-install',
    mode: 'readwrite',
  });
  await verifyCompanionFolder(dir);
  await storeDirHandle(dir);
  return dir;
}

async function resolveInstallDir({ allowPrompt }) {
  const stored = await loadDirHandle();
  if (stored && (await ensureWritePermission(stored, { prompt: allowPrompt }))) {
    try {
      await verifyCompanionFolder(stored);
      return stored;
    } catch {
      /* stale handle */
    }
  }
  if (!allowPrompt) return null;
  return pickCompanionDir();
}

function absoluteDownloadUrl(url) {
  if (!url) return 'https://trade.privacydatacoin.com/api/companion/download';
  if (url.startsWith('/')) return `https://trade.privacydatacoin.com${url}`;
  return url;
}

/**
 * @param {{ zipUrl: string, allowPrompt?: boolean, onStatus?: (msg: string) => void }} opts
 * @returns {Promise<'reloading'|'downloaded'|'cancelled'>}
 */
async function applyCompanionUpdate(opts) {
  const zipUrl = absoluteDownloadUrl(opts.zipUrl);
  const allowPrompt = opts.allowPrompt !== false;
  const onStatus = opts.onStatus || (() => {});

  onStatus('Downloading update…');
  const res = await fetch(zipUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
  const buf = await res.arrayBuffer();

  let dir;
  try {
    dir = await resolveInstallDir({ allowPrompt });
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled';
    throw e;
  }

  if (!dir) {
    onStatus('Opening download…');
    window.open(zipUrl, '_blank', 'noopener');
    return 'downloaded';
  }

  onStatus('Writing files into unpacked folder…');
  const entries = stripCommonRoot(await readZipEntries(buf));
  if (!entries.has('manifest.json')) {
    throw new Error('Update zip missing manifest.json');
  }
  for (const [rel, bytes] of entries) {
    await writeEntry(dir, rel, bytes);
  }

  onStatus('Reloading extension…');
  chrome.runtime.reload();
  return 'reloading';
}

/** Silent auto-apply when a remembered folder still has write permission. */
async function tryAutoApplyUpdate(zipUrl, onStatus) {
  const dir = await resolveInstallDir({ allowPrompt: false });
  if (!dir) return false;
  await applyCompanionUpdate({ zipUrl, allowPrompt: false, onStatus });
  return true;
}

// Non-module popup/options can call via global.
window.PdcCompanionUpdate = {
  applyCompanionUpdate,
  tryAutoApplyUpdate,
};
