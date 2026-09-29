#!/usr/bin/env node
/* Verify the site artifact before publishing; does not print embedded credentials. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const dir = path.resolve(process.argv[2] || '_site');
const buildOnly = process.argv.includes('--build');
function checkBuild(location) {
  const html = fs.readFileSync(path.join(location, 'index.html'), 'utf8');
  assert.match(html, /id="root"/, 'v2 entrypoint must be at this location');
  assert.doesNotMatch(html, /js\/app\.js/, 'root must not serve the legacy application');
  const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"?#]+)"/g)].map(match => match[1]);
  assert.ok(assets.some(asset => asset.endsWith('.js')), 'missing v2 JavaScript');
  assert.ok(assets.some(asset => asset.endsWith('.css')), 'missing v2 CSS');
  for (const asset of assets) assert.ok(fs.statSync(path.resolve(location, asset)).isFile(), `missing asset: ${asset}`);
}
checkBuild(dir);
if (!buildOnly) {
  checkBuild(path.join(dir, 'v2'));
  const legacy = fs.readFileSync(path.join(dir, 'v1', 'index.html'), 'utf8');
  assert.match(legacy, /js\/app\.js/, 'legacy entrypoint must remain available at /v1/');
  for (const file of ['js/app.js', 'js/supabase-sync.js', 'manifest.webmanifest', 'sw.js']) {
    assert.ok(fs.statSync(path.join(dir, 'v1', file)).isFile(), `missing legacy file: ${file}`);
  }
  const retired = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
  assert.match(retired, /registration\.unregister\(\)/, 'old root service worker must retire');
  assert.match(retired, /caches\.delete\('so-tra-no-v1\.3\.0-preview2'\)/, 'old offline cache must be cleared');
  assert.doesNotMatch(retired, /addEventListener\('fetch'/, 'root worker must not serve legacy HTML');
}
console.log(`PASS: ${buildOnly ? 'v2 build' : 'Pages main/preview/legacy artifact'} verified`);