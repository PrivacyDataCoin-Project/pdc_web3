import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadUpdateApi(): {
  assertSafeZipPath: (path: string) => void;
  assertUncompressedSize: (expected: number, actual: number, name: string) => void;
} {
  const code = readFileSync(new URL('../extension/update-apply.js', import.meta.url), 'utf8');
  const sandbox = {
    URL,
    Map,
    Promise,
    TextDecoder,
    console,
    window: {} as {
      PdcCompanionUpdate?: {
        assertSafeZipPath: (path: string) => void;
        assertUncompressedSize: (expected: number, actual: number, name: string) => void;
      };
    },
  };
  vm.runInNewContext(code, sandbox, { filename: 'update-apply.js' });
  const api = sandbox.window.PdcCompanionUpdate;
  if (!api) throw new Error('update api missing');
  return api;
}

describe('companion zip entry guards', () => {
  const api = loadUpdateApi();

  it('accepts companion-relative paths', () => {
    expect(() => api.assertSafeZipPath('manifest.json')).not.toThrow();
    expect(() => api.assertSafeZipPath('icons/icon16.png')).not.toThrow();
  });

  it('rejects traversal, absolute, and empty paths', () => {
    expect(() => api.assertSafeZipPath('../manifest.json')).toThrow(/Unsafe ZIP path/);
    expect(() => api.assertSafeZipPath('foo/../../manifest.json')).toThrow(/Unsafe ZIP path/);
    expect(() => api.assertSafeZipPath('/etc/passwd')).toThrow(/Unsafe ZIP path/);
    expect(() => api.assertSafeZipPath('foo\\bar')).toThrow(/Unsafe ZIP path/);
    expect(() => api.assertSafeZipPath('')).toThrow(/empty/);
    expect(() => api.assertSafeZipPath('foo//bar')).toThrow(/Unsafe ZIP path/);
    expect(() => api.assertSafeZipPath('./manifest.json')).toThrow(/Unsafe ZIP path/);
  });

  it('rejects a deflate size mismatch and allows an unknown size', () => {
    expect(() => api.assertUncompressedSize(4, 4, 'manifest.json')).not.toThrow();
    expect(() => api.assertUncompressedSize(0, 9, 'manifest.json')).not.toThrow();
    expect(() => api.assertUncompressedSize(4, 3, 'manifest.json')).toThrow(/inflated to 3/);
  });
});
