#!/usr/bin/env node
/**
 * Copy validated public/maps → mime-android assets/maps.
 * Default Android tree: ../mime-android next to this repo's parent, or MIME_ANDROID_ROOT.
 */
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcMaps = join(root, 'public', 'maps');

const androidRoot = process.env.MIME_ANDROID_ROOT
  ? resolve(process.env.MIME_ANDROID_ROOT)
  : resolve(root, '..', '..', 'mime-android');
// repo layout: /workspace/mime/app → sibling /workspace/mime-android
const candidates = [
  process.env.MIME_ANDROID_ROOT && resolve(process.env.MIME_ANDROID_ROOT),
  resolve(root, '..', '..', 'mime-android'),
  resolve(root, '..', 'mime-android'),
  resolve('/workspace/mime-android'),
].filter(Boolean);

let destRoot = null;
for (const c of candidates) {
  if (existsSync(join(c, 'app', 'src', 'main'))) {
    destRoot = c;
    break;
  }
}
if (!destRoot) {
  console.error('mime-android not found; set MIME_ANDROID_ROOT');
  process.exit(1);
}

const destMaps = join(destRoot, 'app', 'src', 'main', 'assets', 'maps');
if (!existsSync(srcMaps)) {
  console.error('missing', srcMaps, '— run npm run build:maps first');
  process.exit(1);
}

mkdirSync(dirname(destMaps), { recursive: true });
rmSync(destMaps, { recursive: true, force: true });
cpSync(srcMaps, destMaps, { recursive: true });

function sha256File(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}
function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...walk(p, base));
    else out.push(p.slice(base.length + 1).replace(/\\/g, '/'));
  }
  return out.sort();
}

const files = walk(srcMaps);
const report = files.map((rel) => ({
  path: rel,
  sha256: sha256File(join(srcMaps, rel)),
}));
writeFileSync(join(destMaps, '.export-manifest.json'), JSON.stringify({ files: report }, null, 2) + '\n');
console.log(`exported ${files.length} files → ${destMaps}`);
