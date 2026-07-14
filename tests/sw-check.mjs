// Service-worker integrity check: sw.js must carry the same VERSION as
// config.js (a bump re-triggers install so offline players get a coherent
// new snapshot), and its PRECACHE list must exactly mirror the deployable
// files on disk — a new sound or module missing from the list would be
// absent offline, and a stale entry would 404 the whole install.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert } from './harness.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const config = readFileSync(join(root, 'mooncraft/js/config.js'), 'utf8');

const swVersion = sw.match(/const VERSION = '([^']+)'/)?.[1];
const cfgVersion = config.match(/VERSION = '([^']+)'/)?.[1];
assert(swVersion && swVersion === cfgVersion,
  `sw.js VERSION (${swVersion}) matches config.js (${cfgVersion})`);

const listSrc = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] ?? '';
const precache = [...listSrc.matchAll(/'([^']+)'/g)].map(m => m[1]);
assert(precache.length > 0, `PRECACHE parsed (${precache.length} entries)`);
assert(precache.length === new Set(precache).size, 'no duplicate PRECACHE entries');

// everything the browser can fetch is deployable; repo plumbing is not
const SKIP = new Set(['.git', '.github', 'tests', 'node_modules',
  'CLAUDE.md', 'README.md', 'LICENSE', 'tsconfig.json', 'CNAME', 'sw.js']);
const files = [];
(function walk(rel) {
  for (const name of readdirSync(join(root, rel))) {
    const r = rel ? rel + '/' + name : name;
    if (SKIP.has(r) || name.startsWith('.')) continue;
    if (statSync(join(root, r)).isDirectory()) walk(r);
    else if (!r.endsWith('.d.ts') && !r.endsWith('.md')) files.push(r);
  }
})('');

// index pages are precached under their directory URL, as navigations request them
const expected = new Set(files.map(f =>
  f === 'index.html' ? './' : f.endsWith('/index.html') ? f.slice(0, -'index.html'.length) : f));
const listed = new Set(precache);
const missing = [...expected].filter(u => !listed.has(u)).sort();
const stale = [...listed].filter(u => !expected.has(u)).sort();
assert(missing.length === 0,
  missing.length ? 'files missing from PRECACHE: ' + missing.join(', ')
    : `every deployable file is precached (${expected.size})`);
assert(stale.length === 0,
  stale.length ? 'PRECACHE entries with no file on disk: ' + stale.join(', ')
    : 'no stale PRECACHE entries');

// both entry pages must register the worker, relative to their own depth
assert(readFileSync(join(root, 'index.html'), 'utf8').includes("register('sw.js')"),
  'site index registers the service worker');
assert(readFileSync(join(root, 'mooncraft/index.html'), 'utf8').includes("register('../sw.js')"),
  'game page registers the service worker');

console.log('Service worker OK.');
