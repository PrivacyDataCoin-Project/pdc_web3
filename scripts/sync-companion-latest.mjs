#!/usr/bin/env node
/**
 * Keep extension/latest.json in sync with manifest.json version.
 * Run after bumping the Companion version (also wired as npm run sync:companion-latest).
 *
 * Trade FE mirrors public/companion/latest.json from this file on release/deploy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'extension', 'manifest.json');
const latestPath = path.join(root, 'extension', 'latest.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = String(manifest.version || '').trim();
if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error('manifest.json version must be semver-like, got:', version);
  process.exit(1);
}

const prev = fs.existsSync(latestPath)
  ? JSON.parse(fs.readFileSync(latestPath, 'utf8'))
  : {};

const latest = {
  version,
  name: manifest.name || 'PDC Companion',
  downloadUrl:
    prev.downloadUrl || 'https://trade.privacydatacoin.com/api/companion/download',
  firefoxDownloadUrl:
    prev.firefoxDownloadUrl ||
    'https://trade.privacydatacoin.com/api/companion/download?variant=firefox',
  releaseNotesUrl:
    prev.releaseNotesUrl ||
    'https://github.com/PrivacyDataCoin-Project/pdc_web3/releases',
  htmlUrl: `https://github.com/PrivacyDataCoin-Project/pdc_web3/releases/tag/extension-v${version}`,
  updatedAt: new Date().toISOString().slice(0, 10),
};

fs.writeFileSync(latestPath, `${JSON.stringify(latest, null, 2)}\n`);
console.log('Wrote extension/latest.json →', version);
